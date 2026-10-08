import { OAuthError } from '@/services/oauth/oauthClient';
import type { OAuthTokens } from '@/services/oauth/tokenStore';
import { LocalRepository } from '@/storage/repository';
import { memoryStore } from '@/test/memoryStore';
import { DemoEmailProvider, DEMO_ADDRESS } from '../providers/demo';
import { EmailService } from '../service';
import { EmailError, type EmailAccount, type EmailProvider, type MailContext } from '../types';

// jest.mock factories run lazily and must use require().
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/utils/id', () => {
  let i = 0;
  return { createId: () => `id-${++i}` };
});

function memoryTokens() {
  const data = new Map<string, OAuthTokens>();
  return {
    data,
    get: async (k: string) => data.get(k) ?? null,
    set: async (k: string, v: OAuthTokens) => void data.set(k, v),
    remove: async (k: string) => void data.delete(k),
  };
}

function fakeProvider(overrides: Partial<EmailProvider> = {}): EmailProvider & { seen: MailContext[] } {
  const seen: MailContext[] = [];
  const page = (ctx: MailContext) => {
    seen.push(ctx);
    return Promise.resolve({
      items: [
        {
          id: `m-${ctx.accountId}`,
          accountId: ctx.accountId,
          from: { address: 'x@y.z' },
          subject: 's',
          snippet: '',
          receivedAt: '2026-10-07T10:00:00Z',
          unread: true,
          important: false,
          hasAttachments: false,
        },
      ],
    });
  };
  return {
    id: 'fake',
    seen,
    support: () => ({ supported: true }),
    connect: jest.fn(async () => ({
      address: 'Me@Example.com',
      label: 'Fake',
      tokens: { accessToken: 'a1', refreshToken: 'r1', expiresAt: Date.now() + 3_600_000 },
    })),
    refresh: jest.fn(async (t: OAuthTokens) => ({ ...t, accessToken: 'a2', expiresAt: Date.now() + 3_600_000 })),
    revoke: jest.fn(async () => undefined),
    listFolders: jest.fn(async () => []),
    listMessages: jest.fn(async (ctx: MailContext) => page(ctx)),
    getMessage: jest.fn(),
    send: jest.fn(async () => undefined),
    reply: jest.fn(),
    forward: jest.fn(),
    delete: jest.fn(),
    markRead: jest.fn(),
    markImportant: jest.fn(),
    search: jest.fn(async (ctx: MailContext) => page(ctx)),
    ...overrides,
  } as EmailProvider & { seen: MailContext[] };
}

function setup(provider = fakeProvider()) {
  const kv = memoryStore();
  const tokens = memoryTokens();
  const repo = new LocalRepository<EmailAccount>(kv, 'u', 'emailAccounts');
  const service = new EmailService(repo, 'u', new Map([[provider.id, provider]]), tokens);
  return { service, tokens, provider, repo };
}

describe('EmailService', () => {
  it('connects an account once and refreshes tokens on reconnect instead of duplicating', async () => {
    const { service, tokens } = setup();
    const first = await service.connect('fake');
    const again = await service.connect('fake');
    expect(first?.isNew).toBe(true);
    expect(again?.isNew).toBe(false);
    expect(await service.listAccounts()).toHaveLength(1);
    expect([...tokens.data.keys()]).toEqual([`aun.oauth.mail.u.${first!.account.id}`]);
    // Tokens are never stored with the account metadata.
    expect(JSON.stringify(await service.listAccounts())).not.toContain('a1');
  });

  it('refreshes an expired token before calling the provider', async () => {
    const { service, tokens, provider } = setup();
    const { account } = (await service.connect('fake'))!;
    const key = `aun.oauth.mail.u.${account.id}`;
    tokens.data.set(key, { accessToken: 'old', refreshToken: 'r1', expiresAt: Date.now() - 1000 });
    await service.listMessages(account.id, 'inbox');
    const ctx = (provider as ReturnType<typeof fakeProvider>).seen[0];
    expect(await ctx.getToken()).toBe('a2');
    expect(provider.refresh).toHaveBeenCalled();
    expect(ctx.address).toBe('me@example.com');
  });

  it('marks the account expired when the refresh token is revoked', async () => {
    const provider = fakeProvider({ refresh: jest.fn(async () => Promise.reject(new OAuthError('expired'))) });
    const { service, tokens } = setup(provider);
    const { account } = (await service.connect('fake'))!;
    tokens.data.set(`aun.oauth.mail.u.${account.id}`, { accessToken: 'old', refreshToken: 'bad', expiresAt: 0 });
    (provider.listMessages as jest.Mock).mockImplementation((ctx: MailContext) => ctx.getToken());
    await expect(service.listMessages(account.id, 'inbox')).rejects.toEqual(new EmailError('auth-expired'));
    expect((await service.listAccounts())[0].status).toBe('expired');
  });

  it('reports accounts without tokens as needing reconnection and skips them in the unified inbox', async () => {
    const { service, tokens } = setup();
    const { account } = (await service.connect('fake'))!;
    expect((await service.unifiedInbox()).items).toHaveLength(1);
    tokens.data.clear(); // e.g. web page reloaded
    expect((await service.accountsWithState())[0].state).toBe('reconnect');
    expect((await service.unifiedInbox()).items).toHaveLength(0);
    expect(account.address).toBe('Me@Example.com');
  });

  it('validates recipients and disconnects by revoking without deleting mail', async () => {
    const { service, tokens, provider } = setup();
    const { account } = (await service.connect('fake'))!;
    await expect(service.send(account.id, { to: [{ address: 'not-an-email' }], subject: 'x', body: '' })).rejects.toBeInstanceOf(
      EmailError,
    );
    await service.send(account.id, { to: [{ address: 'ok@example.com' }], subject: ' Hola ', body: 'b' });
    expect((provider.send as jest.Mock).mock.calls[0][1].subject).toBe('Hola');
    await service.disconnect(account);
    expect(provider.revoke).toHaveBeenCalled();
    expect(tokens.data.size).toBe(0);
    expect(await service.listAccounts()).toHaveLength(0);
  });
});

describe('DemoEmailProvider', () => {
  it('delivers mail sent to itself, moves deleted mail to the trash and searches', async () => {
    const demo = new DemoEmailProvider(memoryStore(), 'u');
    const ctx: MailContext = { accountId: 'acc', address: DEMO_ADDRESS, getToken: async () => 'demo' };
    const inbox = (await demo.listMessages(ctx, 'inbox')).items;
    expect(inbox.length).toBeGreaterThan(0);
    await demo.send(ctx, { to: [{ address: DEMO_ADDRESS }], subject: 'Nota para mí', body: 'Comprar pilas' });
    const after = (await demo.listMessages(ctx, 'inbox')).items;
    expect(after[0].subject).toBe('Nota para mí');
    await demo.delete(ctx, after[0].id);
    expect((await demo.listMessages(ctx, 'trash')).items.map((m) => m.subject)).toContain('Nota para mí');
    expect((await demo.search(ctx, 'excursion')).items[0].subject).toMatch(/Excursión/);
  });
});
