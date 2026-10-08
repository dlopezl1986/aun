import { base64UrlToText } from '@/utils/base64';
import { GmailProvider } from '../providers/gmail';
import { OutlookProvider } from '../providers/outlook';
import type { MailContext } from '../types';

type Call = { url: string; method: string; auth?: string; body?: string };
const calls: Call[] = [];

function mockApi(handler: (c: Call) => { status: number; json?: unknown }) {
  globalThis.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const call = { url: String(url), method: init?.method ?? 'GET', auth: headers.Authorization, body: init?.body as string | undefined };
    calls.push(call);
    const { status, json } = handler(call);
    const text = json === undefined ? '' : JSON.stringify(json);
    return { ok: status >= 200 && status < 300, status, json: async () => json, text: async () => text } as Response;
  }) as typeof fetch;
}

const getToken = jest.fn(async (force?: boolean) => (force ? 'fresh' : 'stale'));
const ctx: MailContext = { accountId: 'acc', address: 'me@gmail.com', getToken };

beforeEach(() => {
  calls.length = 0;
  getToken.mockClear();
});

describe('GmailProvider', () => {
  const gmail = new GmailProvider();

  it('lists a folder with metadata and retries once on 401 with a fresh token', async () => {
    let first = true;
    mockApi((c) => {
      if (first) {
        first = false;
        return { status: 401 };
      }
      if (c.url.includes('/messages?')) return { status: 200, json: { messages: [{ id: 'm1' }], nextPageToken: 'p2' } };
      return {
        status: 200,
        json: {
          id: 'm1',
          threadId: 't1',
          labelIds: ['INBOX', 'UNREAD'],
          snippet: 'Hola &amp; adiós',
          internalDate: '1791360000000',
          payload: {
            headers: [
              { name: 'From', value: '"Colegio" <cole@x.com>' },
              { name: 'Subject', value: '=?UTF-8?B?RXhjdXJzacOzbg==?=' },
            ],
          },
        },
      };
    });
    const page = await gmail.listMessages(ctx, 'inbox');
    expect(calls[1].auth).toBe('Bearer fresh');
    expect(calls[1].url).toContain('labelIds=INBOX');
    expect(page.next).toBe('p2');
    expect(page.items[0]).toMatchObject({
      id: 'm1',
      unread: true,
      subject: 'Excursión',
      snippet: 'Hola & adiós',
      from: { name: 'Colegio', address: 'cole@x.com' },
    });
  });

  it('sends a raw RFC 5322 message and uses labels for read/trash', async () => {
    mockApi(() => ({ status: 200, json: {} }));
    await gmail.send(ctx, { to: [{ address: 'ana@x.com' }], subject: 'Hola', body: 'Qué tal' });
    const raw = base64UrlToText(JSON.parse(calls[0].body!).raw);
    expect(raw).toContain('To: ana@x.com');
    await gmail.markRead(ctx, 'm1', true);
    expect(JSON.parse(calls[1].body!)).toEqual({ addLabelIds: [], removeLabelIds: ['UNREAD'] });
    await gmail.delete(ctx, 'm1');
    expect(calls[2].url).toMatch(/messages\/m1\/trash$/);
  });
});

describe('OutlookProvider', () => {
  const outlook = new OutlookProvider();

  it('reads a well-known folder and follows Graph nextLink cursors only', async () => {
    mockApi(() => ({
      status: 200,
      json: {
        value: [
          {
            id: 'o1',
            subject: 'Factura',
            isRead: false,
            importance: 'high',
            receivedDateTime: '2026-10-07T08:00:00Z',
            from: { emailAddress: { name: 'Luz', address: 'luz@x.com' } },
          },
        ],
        '@odata.nextLink': 'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$skip=25',
      },
    }));
    const page = await outlook.listMessages(ctx, 'inbox');
    expect(calls[0].url).toContain('/mailFolders/inbox/messages');
    expect(page.items[0]).toMatchObject({ id: 'o1', unread: true, important: true, from: { name: 'Luz', address: 'luz@x.com' } });
    await outlook.listMessages(ctx, 'inbox', page.next);
    expect(calls[1].url).toBe(page.next);
    await outlook.listMessages(ctx, 'inbox', 'https://evil.example/steal');
    expect(calls[2].url).toContain('graph.microsoft.com');
  });

  it('sends JSON, replies through Graph and moves deleted mail to Deleted Items', async () => {
    mockApi(() => ({ status: 202 }));
    await outlook.send(ctx, { to: [{ name: 'Ana', address: 'ana@x.com' }], subject: 'Hola', body: 'Qué tal' });
    expect(JSON.parse(calls[0].body!).message.toRecipients).toEqual([{ emailAddress: { address: 'ana@x.com', name: 'Ana' } }]);
    await outlook.reply(ctx, { id: 'o1' } as never, 'Gracias', true);
    expect(calls[1].url).toMatch(/messages\/o1\/replyAll$/);
    await outlook.delete(ctx, 'o1');
    expect(JSON.parse(calls[2].body!)).toEqual({ destinationId: 'deleteditems' });
  });
});
