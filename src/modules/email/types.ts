import type { OAuthSupport } from '@/services/oauth/oauthClient';
import type { OAuthTokens } from '@/services/oauth/tokenStore';
import type { BaseEntity } from '@/types/entity';

export type EmailProviderId = 'gmail' | 'outlook' | 'demo' | (string & {});

/**
 * A connected mailbox. Only non-secret metadata is stored here; OAuth tokens
 * live in the OS keychain (native) or in memory (web) — never in plain
 * storage, never passwords.
 */
export interface EmailAccount extends BaseEntity {
  provider: EmailProviderId;
  address: string;
  label: string;
  /** Last known state; the live state also depends on the stored tokens. */
  status: 'connected' | 'expired' | 'error';
}

export type FolderRole = 'inbox' | 'sent' | 'drafts' | 'trash' | 'spam' | 'archive' | 'important' | 'starred';

export interface EmailFolder {
  id: string;
  name: string;
  role?: FolderRole | null;
  unread?: number;
}

export interface EmailAddress {
  name?: string;
  address: string;
}

export interface EmailSummary {
  id: string;
  accountId: string;
  threadId?: string;
  from: EmailAddress;
  subject: string;
  snippet: string;
  receivedAt: string;
  unread: boolean;
  important: boolean;
  hasAttachments: boolean;
}

export interface EmailAttachmentInfo {
  name: string;
  mimeType: string;
  size?: number;
}

export interface EmailMessage extends EmailSummary {
  to: EmailAddress[];
  cc: EmailAddress[];
  bodyHtml?: string;
  bodyText?: string;
  attachments: EmailAttachmentInfo[];
  /** RFC 822 Message-ID (threading of replies). */
  messageIdHeader?: string;
}

export interface OutgoingEmail {
  to: EmailAddress[];
  cc?: EmailAddress[];
  subject: string;
  body: string;
}

export interface MessagePage {
  items: EmailSummary[];
  next?: string;
}

/** Per-account access to a valid token (refreshing when the provider allows it). */
export interface MailContext {
  accountId: string;
  /** The mailbox address (excluded from "reply all"). */
  address: string;
  getToken(forceRefresh?: boolean): Promise<string>;
}

export interface EmailConnection {
  address: string;
  label: string;
  tokens: OAuthTokens;
}

/**
 * Contract implemented by GmailProvider / OutlookProvider (and later IMAP,
 * Yahoo…). Stateless: everything account-specific arrives in `MailContext`.
 */
export interface EmailProvider {
  readonly id: EmailProviderId;
  support(): OAuthSupport;
  /** Opens the provider's OAuth consent screen; null when the user cancels. */
  connect(): Promise<EmailConnection | null>;
  refresh(tokens: OAuthTokens): Promise<OAuthTokens>;
  revoke(tokens: OAuthTokens): Promise<void>;
  listFolders(ctx: MailContext): Promise<EmailFolder[]>;
  /** `folderId` may also be a role alias ("inbox"). */
  listMessages(ctx: MailContext, folderId: string, cursor?: string): Promise<MessagePage>;
  getMessage(ctx: MailContext, messageId: string): Promise<EmailMessage>;
  send(ctx: MailContext, message: OutgoingEmail): Promise<void>;
  reply(ctx: MailContext, original: EmailMessage, body: string, replyAll: boolean): Promise<void>;
  forward(ctx: MailContext, original: EmailMessage, to: EmailAddress[], body: string): Promise<void>;
  /** Moves the message to the trash (never a permanent delete). */
  delete(ctx: MailContext, messageId: string): Promise<void>;
  markRead(ctx: MailContext, messageId: string, read: boolean): Promise<void>;
  markImportant(ctx: MailContext, messageId: string, important: boolean): Promise<void>;
  search(ctx: MailContext, query: string): Promise<MessagePage>;
}

export class EmailError extends Error {
  constructor(
    readonly code: 'not-connected' | 'auth-expired' | 'not-found' | 'network' | 'rate-limited' | 'invalid' | 'unknown',
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'EmailError';
  }
}
