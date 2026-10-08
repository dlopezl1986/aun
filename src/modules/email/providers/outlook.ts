import { appConfig } from '@/config/featureFlags';
import { authorize, oauthSupport, refreshTokens, revokeTokens, type OAuthProviderConfig } from '@/services/oauth/oauthClient';
import {
  EmailError,
  type EmailAddress,
  type EmailConnection,
  type EmailFolder,
  type EmailMessage,
  type EmailProvider,
  type EmailSummary,
  type FolderRole,
  type MailContext,
  type MessagePage,
  type OutgoingEmail,
} from '../types';
import { htmlToText, mailFetch } from './http';

const GRAPH = 'https://graph.microsoft.com/v1.0/me';

/**
 * Microsoft identity platform, public client (no secret):
 *  - Web: Authorization Code + PKCE (redirect registered as "SPA").
 *  - iOS/Android: Code + PKCE with the `aun://` scheme ("Mobile and desktop").
 * Works for personal Outlook.com and work/school Microsoft 365 accounts.
 */
export const outlookOAuth: OAuthProviderConfig = {
  name: 'Outlook',
  discovery: {
    authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  },
  clientId: () => appConfig.microsoftClientId,
  scopes: ['openid', 'email', 'profile', 'offline_access', 'User.Read', 'Mail.ReadWrite', 'Mail.Send'],
  webFlow: 'pkce',
  nativeRedirect: () => 'aun://oauth/microsoft',
  prompt: 'select_account',
};

/** Well-known folder names, which Graph also accepts as folder ids. */
const WELL_KNOWN: [FolderRole, string][] = [
  ['inbox', 'inbox'],
  ['sent', 'sentitems'],
  ['drafts', 'drafts'],
  ['archive', 'archive'],
  ['spam', 'junkemail'],
  ['trash', 'deleteditems'],
];

interface GraphRecipient {
  emailAddress?: { name?: string; address?: string };
}
export interface GraphMessage {
  id: string;
  conversationId?: string;
  internetMessageId?: string;
  subject?: string | null;
  bodyPreview?: string;
  receivedDateTime?: string;
  isRead?: boolean;
  importance?: 'low' | 'normal' | 'high';
  flag?: { flagStatus?: string };
  hasAttachments?: boolean;
  from?: GraphRecipient;
  toRecipients?: GraphRecipient[];
  ccRecipients?: GraphRecipient[];
  body?: { contentType: 'html' | 'text'; content: string };
}

const SUMMARY_FIELDS = 'id,conversationId,subject,bodyPreview,receivedDateTime,isRead,importance,flag,hasAttachments,from';

const toAddress = (r?: GraphRecipient): EmailAddress => ({
  name: r?.emailAddress?.name || undefined,
  address: r?.emailAddress?.address ?? '',
});
const toRecipient = (a: EmailAddress) => ({ emailAddress: { address: a.address, ...(a.name ? { name: a.name } : {}) } });

export function graphToSummary(m: GraphMessage, accountId: string): EmailSummary {
  return {
    id: m.id,
    accountId,
    threadId: m.conversationId,
    from: toAddress(m.from),
    subject: m.subject ?? '',
    snippet: m.bodyPreview ?? '',
    receivedAt: m.receivedDateTime ?? new Date().toISOString(),
    unread: m.isRead === false,
    important: m.importance === 'high' || m.flag?.flagStatus === 'flagged',
    hasAttachments: !!m.hasAttachments,
  };
}

export class OutlookProvider implements EmailProvider {
  readonly id = 'outlook';

  support() {
    return oauthSupport(outlookOAuth);
  }

  async connect(): Promise<EmailConnection | null> {
    const tokens = await authorize(outlookOAuth);
    if (!tokens) return null;
    const res = await fetch(`${GRAPH}?$select=displayName,mail,userPrincipalName`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    if (!res.ok) throw new EmailError('auth-expired');
    const me = (await res.json()) as { displayName?: string; mail?: string | null; userPrincipalName?: string };
    const address = me.mail ?? me.userPrincipalName ?? '';
    return { address, label: 'Outlook', tokens: { ...tokens, accountEmail: address } };
  }

  refresh(tokens: Parameters<EmailProvider['refresh']>[0]) {
    return refreshTokens(outlookOAuth, tokens);
  }

  revoke(tokens: Parameters<EmailProvider['revoke']>[0]) {
    return revokeTokens(outlookOAuth, tokens);
  }

  async listFolders(ctx: MailContext): Promise<EmailFolder[]> {
    const known = await Promise.all(
      WELL_KNOWN.map(async ([role, name]) => {
        try {
          const f = await mailFetch<{ id: string; displayName: string; unreadItemCount?: number }>(ctx, `${GRAPH}/mailFolders/${name}`);
          return { id: f.id, name: f.displayName, role, unread: role === 'inbox' || role === 'spam' ? f.unreadItemCount : undefined };
        } catch {
          return null; // e.g. no "archive" folder on some accounts
        }
      }),
    );
    const sys = known.filter((f): f is NonNullable<typeof f> => !!f);
    const ids = new Set(sys.map((f) => f.id));
    const all = await mailFetch<{ value: { id: string; displayName: string; unreadItemCount?: number }[] }>(
      ctx,
      `${GRAPH}/mailFolders?$top=100&$select=id,displayName,unreadItemCount`,
    );
    const custom = all.value
      .filter((f) => !ids.has(f.id))
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
      .map((f) => ({ id: f.id, name: f.displayName, role: null, unread: f.unreadItemCount }));
    return [...sys, ...custom];
  }

  private async page(ctx: MailContext, url: string): Promise<MessagePage> {
    const res = await mailFetch<{ value: GraphMessage[]; '@odata.nextLink'?: string }>(ctx, url);
    return { items: res.value.map((m) => graphToSummary(m, ctx.accountId)), next: res['@odata.nextLink'] };
  }

  listMessages(ctx: MailContext, folderId: string, cursor?: string): Promise<MessagePage> {
    const folder = WELL_KNOWN.find(([role]) => role === folderId)?.[1] ?? folderId;
    // The cursor is Graph's own nextLink (always a graph.microsoft.com URL).
    if (cursor && cursor.startsWith('https://graph.microsoft.com/')) return this.page(ctx, cursor);
    return this.page(
      ctx,
      `${GRAPH}/mailFolders/${encodeURIComponent(folder)}/messages?$top=25&$orderby=receivedDateTime desc&$select=${SUMMARY_FIELDS}`,
    );
  }

  search(ctx: MailContext, query: string): Promise<MessagePage> {
    const q = encodeURIComponent(`"${query.replace(/"/g, '')}"`);
    return this.page(ctx, `${GRAPH}/messages?$top=25&$search=${q}&$select=${SUMMARY_FIELDS}`);
  }

  async getMessage(ctx: MailContext, messageId: string): Promise<EmailMessage> {
    const m = await mailFetch<GraphMessage>(
      ctx,
      `${GRAPH}/messages/${messageId}?$select=${SUMMARY_FIELDS},toRecipients,ccRecipients,body,internetMessageId`,
    );
    let attachments: EmailMessage['attachments'] = [];
    if (m.hasAttachments) {
      const a = await mailFetch<{ value: { name: string; contentType: string; size?: number; isInline?: boolean }[] }>(
        ctx,
        `${GRAPH}/messages/${messageId}/attachments?$select=name,contentType,size,isInline`,
      ).catch(() => ({ value: [] }));
      attachments = a.value.filter((x) => !x.isInline).map((x) => ({ name: x.name, mimeType: x.contentType, size: x.size }));
    }
    const html = m.body?.contentType === 'html' ? m.body.content : undefined;
    return {
      ...graphToSummary(m, ctx.accountId),
      to: (m.toRecipients ?? []).map(toAddress),
      cc: (m.ccRecipients ?? []).map(toAddress),
      bodyHtml: html,
      bodyText: html ? htmlToText(html) : (m.body?.content ?? ''),
      attachments,
      messageIdHeader: m.internetMessageId,
    };
  }

  async send(ctx: MailContext, message: OutgoingEmail) {
    await mailFetch(ctx, `${GRAPH}/sendMail`, {
      method: 'POST',
      body: JSON.stringify({
        message: {
          subject: message.subject,
          body: { contentType: 'Text', content: message.body },
          toRecipients: message.to.map(toRecipient),
          ccRecipients: (message.cc ?? []).map(toRecipient),
        },
        saveToSentItems: true,
      }),
    });
  }

  async reply(ctx: MailContext, original: EmailMessage, body: string, replyAll: boolean) {
    // Graph builds the recipients ("replyAll" excludes the mailbox owner), the quote and the threading.
    await mailFetch(ctx, `${GRAPH}/messages/${original.id}/${replyAll ? 'replyAll' : 'reply'}`, {
      method: 'POST',
      body: JSON.stringify({ comment: body }),
    });
  }

  async forward(ctx: MailContext, original: EmailMessage, to: EmailAddress[], body: string) {
    await mailFetch(ctx, `${GRAPH}/messages/${original.id}/forward`, {
      method: 'POST',
      body: JSON.stringify({ comment: body, toRecipients: to.map(toRecipient) }),
    });
  }

  async delete(ctx: MailContext, messageId: string) {
    await mailFetch(ctx, `${GRAPH}/messages/${messageId}/move`, {
      method: 'POST',
      body: JSON.stringify({ destinationId: 'deleteditems' }),
    });
  }

  async markRead(ctx: MailContext, messageId: string, read: boolean) {
    await mailFetch(ctx, `${GRAPH}/messages/${messageId}`, { method: 'PATCH', body: JSON.stringify({ isRead: read }) });
  }

  async markImportant(ctx: MailContext, messageId: string, important: boolean) {
    await mailFetch(ctx, `${GRAPH}/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ importance: important ? 'high' : 'normal' }),
    });
  }
}
