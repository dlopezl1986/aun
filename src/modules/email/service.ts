import { OAuthError } from '@/services/oauth/oauthClient';
import { tokenStore as defaultTokenStore, type OAuthTokens } from '@/services/oauth/tokenStore';
import type { Repository } from '@/storage/repository';
import { isEmail } from './providers/http';
import {
  EmailError,
  type EmailAccount,
  type EmailAddress,
  type EmailFolder,
  type EmailMessage,
  type EmailProvider,
  type EmailProviderId,
  type EmailSummary,
  type MailContext,
  type MessagePage,
  type OutgoingEmail,
} from './types';

type TokenStore = Pick<typeof defaultTokenStore, 'get' | 'set' | 'remove'>;

export type AccountState = 'connected' | 'reconnect';

export interface MergedPage {
  items: EmailSummary[];
  /** Accounts that could not be read (expired session, network…). */
  failed: { accountId: string; code: EmailError['code'] }[];
}

/**
 * Orchestrates several mailboxes (Gmail personal, Outlook trabajo…) over
 * stateless providers. Tokens are stored per account in the keychain
 * (native) or memory (web) — never with the account metadata.
 */
export class EmailService {
  constructor(
    private readonly accounts: Repository<EmailAccount>,
    private readonly userId: string,
    private readonly providers: Map<EmailProviderId, EmailProvider>,
    private readonly tokens: TokenStore = defaultTokenStore,
  ) {}

  private tokenKey(accountId: string) {
    return `aun.oauth.mail.${this.userId}.${accountId}`;
  }

  provider(id: EmailProviderId): EmailProvider {
    const p = this.providers.get(id);
    if (!p) throw new EmailError('not-connected', `Provider ${id} not available`);
    return p;
  }

  availableProviders(): EmailProvider[] {
    return [...this.providers.values()];
  }

  async listAccounts(): Promise<EmailAccount[]> {
    return (await this.accounts.list()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  /** Live state: do we hold usable tokens for this account on this device? */
  async accountState(account: EmailAccount): Promise<AccountState> {
    if (!this.providers.has(account.provider)) return 'reconnect';
    const t = await this.tokens.get(this.tokenKey(account.id));
    if (!t) return 'reconnect';
    return t.expiresAt > Date.now() + 30_000 || t.refreshToken ? 'connected' : 'reconnect';
  }

  async accountsWithState(): Promise<(EmailAccount & { state: AccountState })[]> {
    const list = await this.listAccounts();
    return Promise.all(list.map(async (a) => ({ ...a, state: await this.accountState(a) })));
  }

  /**
   * OAuth consent → account. Connecting the same mailbox again (e.g. after the
   * session expired) refreshes its tokens instead of duplicating it.
   */
  async connect(providerId: EmailProviderId): Promise<{ account: EmailAccount; isNew: boolean } | null> {
    const connection = await this.provider(providerId).connect();
    if (!connection) return null;
    const existing = (await this.accounts.list()).find(
      (a) => a.provider === providerId && a.address.toLowerCase() === connection.address.toLowerCase(),
    );
    const account = existing
      ? await this.accounts.update(existing.id, { status: 'connected' })
      : await this.accounts.create({ provider: providerId, address: connection.address, label: connection.label, status: 'connected' });
    await this.tokens.set(this.tokenKey(account.id), connection.tokens);
    return { account, isNew: !existing };
  }

  renameAccount(id: string, label: string): Promise<EmailAccount> {
    const clean = label.trim();
    if (!clean) throw new EmailError('invalid');
    return this.accounts.update(id, { label: clean });
  }

  /** Revokes AUN's access and forgets the account. Never deletes any e-mail. */
  async disconnect(account: EmailAccount): Promise<void> {
    const t = await this.tokens.get(this.tokenKey(account.id));
    if (t) await this.providers.get(account.provider)?.revoke(t);
    await this.tokens.remove(this.tokenKey(account.id));
    await this.accounts.remove(account.id);
  }

  private async context(accountId: string): Promise<{ ctx: MailContext; provider: EmailProvider }> {
    const account = await this.accounts.get(accountId);
    if (!account) throw new EmailError('not-found');
    const provider = this.provider(account.provider);
    const key = this.tokenKey(account.id);
    const expire = async () => {
      await this.accounts.update(account.id, { status: 'expired' });
      return new EmailError('auth-expired');
    };
    const ctx: MailContext = {
      accountId: account.id,
      address: account.address.toLowerCase(),
      getToken: async (forceRefresh = false) => {
        const t = await this.tokens.get(key);
        if (!t) throw await expire();
        if (!forceRefresh && t.expiresAt > Date.now() + 60_000) return t.accessToken;
        try {
          const next: OAuthTokens = await provider.refresh(t);
          await this.tokens.set(key, next);
          return next.accessToken;
        } catch (e) {
          if (e instanceof OAuthError) throw await expire();
          throw e;
        }
      },
    };
    return { ctx, provider };
  }

  async listFolders(accountId: string): Promise<EmailFolder[]> {
    const { ctx, provider } = await this.context(accountId);
    return provider.listFolders(ctx);
  }

  async listMessages(accountId: string, folderId: string, cursor?: string): Promise<MessagePage> {
    const { ctx, provider } = await this.context(accountId);
    return provider.listMessages(ctx, folderId, cursor);
  }

  private async merge(accounts: EmailAccount[], run: (ctx: MailContext, p: EmailProvider) => Promise<MessagePage>): Promise<MergedPage> {
    const failed: MergedPage['failed'] = [];
    const pages = await Promise.all(
      accounts.map(async (a) => {
        try {
          const { ctx, provider } = await this.context(a.id);
          return (await run(ctx, provider)).items;
        } catch (e) {
          failed.push({ accountId: a.id, code: e instanceof EmailError ? e.code : 'unknown' });
          return [];
        }
      }),
    );
    return { items: pages.flat().sort((x, y) => y.receivedAt.localeCompare(x.receivedAt)), failed };
  }

  /** "Todas las bandejas": first page of every connected inbox, newest first. */
  async unifiedInbox(): Promise<MergedPage> {
    const accounts = (await this.accountsWithState()).filter((a) => a.state === 'connected');
    return this.merge(accounts, (ctx, p) => p.listMessages(ctx, 'inbox'));
  }

  async search(query: string, accountId?: string): Promise<MergedPage> {
    const q = query.trim();
    if (!q) return { items: [], failed: [] };
    const accounts = (await this.accountsWithState()).filter((a) => a.state === 'connected' && (!accountId || a.id === accountId));
    return this.merge(accounts, (ctx, p) => p.search(ctx, q));
  }

  async getMessage(accountId: string, messageId: string): Promise<EmailMessage> {
    const { ctx, provider } = await this.context(accountId);
    return provider.getMessage(ctx, messageId);
  }

  private validateRecipients(list: EmailAddress[]) {
    if (!list.length || list.some((a) => !isEmail(a.address))) throw new EmailError('invalid', 'recipients');
  }

  async send(accountId: string, message: OutgoingEmail): Promise<void> {
    this.validateRecipients([...message.to, ...(message.cc ?? [])]);
    const { ctx, provider } = await this.context(accountId);
    await provider.send(ctx, { ...message, subject: message.subject.trim() });
  }

  async reply(accountId: string, original: EmailMessage, body: string, replyAll = false): Promise<void> {
    const { ctx, provider } = await this.context(accountId);
    await provider.reply(ctx, original, body, replyAll);
  }

  async forward(accountId: string, original: EmailMessage, to: EmailAddress[], body: string): Promise<void> {
    this.validateRecipients(to);
    const { ctx, provider } = await this.context(accountId);
    await provider.forward(ctx, original, to, body);
  }

  async delete(accountId: string, messageId: string): Promise<void> {
    const { ctx, provider } = await this.context(accountId);
    await provider.delete(ctx, messageId);
  }

  async markRead(accountId: string, messageId: string, read: boolean): Promise<void> {
    const { ctx, provider } = await this.context(accountId);
    await provider.markRead(ctx, messageId, read);
  }

  async markImportant(accountId: string, messageId: string, important: boolean): Promise<void> {
    const { ctx, provider } = await this.context(accountId);
    await provider.markImportant(ctx, messageId, important);
  }
}
