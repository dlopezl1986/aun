import { appConfig } from '@/config/featureFlags';
import { authorize, oauthSupport, refreshTokens, revokeTokens, type OAuthProviderConfig } from '@/services/oauth/oauthClient';
import { reversedClientId } from '@/services/oauth/googleOAuth';
import { base64Decode, latin1Decode, textToBase64Url, utf8Decode } from '@/utils/base64';
import { Platform } from 'react-native';
import {
  EmailError,
  type EmailConnection,
  type EmailFolder,
  type EmailMessage,
  type EmailProvider,
  type EmailSummary,
  type FolderRole,
  type MailContext,
  type MessagePage,
} from '../types';
import { htmlToText, mailFetch, parseAddress, parseAddressList, quoteOriginal, replyAllCc } from './http';
import { buildMime, prefixSubject } from './mime';

const API = 'https://gmail.googleapis.com/gmail/v1/users/me';

/**
 * Least privilege for the features AUN offers: `gmail.modify` (read, labels,
 * trash — NOT permanent delete) + `gmail.send`. Both are "restricted" scopes:
 * publishing to everyone requires Google's verification (docs/INTEGRATIONS.md).
 */
export const gmailOAuth: OAuthProviderConfig = {
  name: 'Gmail',
  discovery: {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
  },
  clientId: () =>
    Platform.OS === 'web'
      ? appConfig.googleWebClientId
      : Platform.OS === 'ios'
        ? appConfig.googleIosClientId
        : appConfig.googleAndroidClientId,
  scopes: ['openid', 'email', 'https://www.googleapis.com/auth/gmail.modify', 'https://www.googleapis.com/auth/gmail.send'],
  webFlow: 'implicit',
  nativeRedirect: (id) => `${reversedClientId(id)}:/oauthredirect`,
  // Google rejects custom-scheme redirects on Android: needs the native sign-in module.
  unsupportedPlatforms: ['android'],
  prompt: 'select_account consent',
  extraParams: { native: { access_type: 'offline' } },
};

const ROLE_BY_LABEL: Record<string, FolderRole> = {
  INBOX: 'inbox',
  SENT: 'sent',
  DRAFT: 'drafts',
  TRASH: 'trash',
  SPAM: 'spam',
  IMPORTANT: 'important',
  STARRED: 'starred',
};
const LABEL_BY_ROLE: Record<string, string> = Object.fromEntries(Object.entries(ROLE_BY_LABEL).map(([k, v]) => [v, k]));

interface GmailHeader {
  name: string;
  value: string;
}
export interface GmailPart {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: GmailPart[];
}
export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart;
}

const header = (part: GmailPart | undefined, name: string) =>
  part?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';

/** Decodes RFC 2047 encoded-words in headers ("=?UTF-8?B?...?="). */
export function decodeHeader(value: string): string {
  return value.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, charset: string, enc: string, data: string) => {
    let bytes: Uint8Array;
    if (enc.toUpperCase() === 'B') bytes = base64Decode(data);
    else {
      const s = data.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (__, h: string) => String.fromCharCode(parseInt(h, 16)));
      bytes = Uint8Array.from([...s].map((c) => c.charCodeAt(0)));
    }
    return /utf-?8/i.test(charset) ? utf8Decode(bytes) : latin1Decode(bytes);
  });
}

function decodeBody(part: GmailPart): string {
  if (!part.body?.data) return '';
  const bytes = base64Decode(part.body.data);
  const contentType = header(part, 'Content-Type');
  return /charset="?(iso-8859-1|windows-1252|latin1)/i.test(contentType) ? latin1Decode(bytes) : utf8Decode(bytes);
}

/** Walks the MIME tree: first text/html and text/plain bodies + attachment list. */
export function extractBodies(root: GmailPart | undefined): { html?: string; text?: string; attachments: EmailMessage['attachments'] } {
  const result: { html?: string; text?: string; attachments: EmailMessage['attachments'] } = { attachments: [] };
  const walk = (p: GmailPart) => {
    if (p.filename && (p.body?.attachmentId || p.body?.size)) {
      result.attachments.push({ name: p.filename, mimeType: p.mimeType ?? 'application/octet-stream', size: p.body?.size });
      return;
    }
    if (p.mimeType === 'text/html' && result.html === undefined) result.html = decodeBody(p);
    else if (p.mimeType === 'text/plain' && result.text === undefined) result.text = decodeBody(p);
    p.parts?.forEach(walk);
  };
  if (root) walk(root);
  return result;
}

export function toSummary(m: GmailMessage, accountId: string): EmailSummary {
  const from = parseAddress(decodeHeader(header(m.payload, 'From')) || 'unknown');
  const labels = m.labelIds ?? [];
  return {
    id: m.id,
    accountId,
    threadId: m.threadId,
    from,
    subject: decodeHeader(header(m.payload, 'Subject')),
    snippet: htmlToText(m.snippet ?? ''),
    receivedAt: new Date(Number(m.internalDate ?? Date.now())).toISOString(),
    unread: labels.includes('UNREAD'),
    important: labels.includes('IMPORTANT') || labels.includes('STARRED'),
    hasAttachments: hasAttachment(m.payload),
  };
}

const hasAttachment = (p?: GmailPart): boolean => !!p && (!!(p.filename && p.body?.attachmentId) || !!p.parts?.some(hasAttachment));

async function userEmail(accessToken: string): Promise<string> {
  const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new EmailError('auth-expired');
  return ((await res.json()) as { email: string }).email;
}

export class GmailProvider implements EmailProvider {
  readonly id = 'gmail';

  support() {
    return oauthSupport(gmailOAuth);
  }

  async connect(): Promise<EmailConnection | null> {
    const tokens = await authorize(gmailOAuth);
    if (!tokens) return null;
    const address = await userEmail(tokens.accessToken);
    return { address, label: 'Gmail', tokens: { ...tokens, accountEmail: address } };
  }

  refresh(tokens: Parameters<EmailProvider['refresh']>[0]) {
    return refreshTokens(gmailOAuth, tokens);
  }

  revoke(tokens: Parameters<EmailProvider['revoke']>[0]) {
    return revokeTokens(gmailOAuth, tokens);
  }

  async listFolders(ctx: MailContext): Promise<EmailFolder[]> {
    const { labels } = await mailFetch<{ labels: { id: string; name: string; type: string }[] }>(ctx, `${API}/labels`);
    const system = ['INBOX', 'STARRED', 'IMPORTANT', 'SENT', 'DRAFT', 'SPAM', 'TRASH'];
    const counts = await Promise.all(
      ['INBOX', 'SPAM'].map((id) =>
        mailFetch<{ messagesUnread?: number }>(ctx, `${API}/labels/${id}`).catch(() => ({ messagesUnread: 0 })),
      ),
    );
    const unread: Record<string, number> = { INBOX: counts[0].messagesUnread ?? 0, SPAM: counts[1].messagesUnread ?? 0 };
    const sys = system
      .filter((id) => labels.some((l) => l.id === id))
      .map((id) => ({ id, name: id, role: ROLE_BY_LABEL[id] ?? null, unread: unread[id] }));
    const user = labels
      .filter((l) => l.type === 'user')
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((l) => ({ id: l.id, name: l.name, role: null }));
    return [...sys, ...user];
  }

  private async page(ctx: MailContext, params: URLSearchParams): Promise<MessagePage> {
    params.set('maxResults', '25');
    const list = await mailFetch<{ messages?: { id: string }[]; nextPageToken?: string }>(ctx, `${API}/messages?${params}`);
    const metadata = 'format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date';
    const items = await Promise.all((list.messages ?? []).map((m) => mailFetch<GmailMessage>(ctx, `${API}/messages/${m.id}?${metadata}`)));
    return { items: items.map((m) => toSummary(m, ctx.accountId)), next: list.nextPageToken };
  }

  listMessages(ctx: MailContext, folderId: string, cursor?: string): Promise<MessagePage> {
    const params = new URLSearchParams({ labelIds: LABEL_BY_ROLE[folderId] ?? folderId });
    if (cursor) params.set('pageToken', cursor);
    return this.page(ctx, params);
  }

  search(ctx: MailContext, query: string): Promise<MessagePage> {
    return this.page(ctx, new URLSearchParams({ q: query }));
  }

  async getMessage(ctx: MailContext, messageId: string): Promise<EmailMessage> {
    const m = await mailFetch<GmailMessage>(ctx, `${API}/messages/${messageId}?format=full`);
    const bodies = extractBodies(m.payload);
    return {
      ...toSummary(m, ctx.accountId),
      to: parseAddressList(decodeHeader(header(m.payload, 'To'))),
      cc: parseAddressList(decodeHeader(header(m.payload, 'Cc'))),
      bodyHtml: bodies.html,
      bodyText: bodies.text ?? (bodies.html ? htmlToText(bodies.html) : ''),
      attachments: bodies.attachments,
      messageIdHeader: header(m.payload, 'Message-ID') || header(m.payload, 'Message-Id') || undefined,
    };
  }

  private async sendRaw(ctx: MailContext, raw: string, threadId?: string) {
    await mailFetch(ctx, `${API}/messages/send`, {
      method: 'POST',
      body: JSON.stringify({ raw: textToBase64Url(raw), ...(threadId ? { threadId } : {}) }),
    });
  }

  send(ctx: MailContext, message: Parameters<EmailProvider['send']>[1]) {
    return this.sendRaw(ctx, buildMime(message));
  }

  async reply(ctx: MailContext, original: EmailMessage, body: string, replyAll: boolean) {
    const to = [original.from];
    const cc = replyAll ? replyAllCc(original, ctx.address) : [];
    const quoted = quoteOriginal(`${original.from.name ?? original.from.address} <${original.from.address}>:`, original.bodyText ?? '');
    await this.sendRaw(
      ctx,
      buildMime({
        to,
        cc,
        subject: prefixSubject('Re', original.subject),
        body: body + quoted,
        inReplyTo: original.messageIdHeader,
        references: original.messageIdHeader,
      }),
      original.threadId,
    );
  }

  forward(ctx: MailContext, original: EmailMessage, to: Parameters<EmailProvider['forward']>[2], body: string) {
    const quoted = quoteOriginal(`---------- ${original.from.address} · ${original.subject}`, original.bodyText ?? '');
    return this.sendRaw(ctx, buildMime({ to, subject: prefixSubject('Fwd', original.subject), body: body + quoted }));
  }

  async delete(ctx: MailContext, messageId: string) {
    await mailFetch(ctx, `${API}/messages/${messageId}/trash`, { method: 'POST' });
  }

  private modify(ctx: MailContext, id: string, add: string[], remove: string[]) {
    return mailFetch(ctx, `${API}/messages/${id}/modify`, {
      method: 'POST',
      body: JSON.stringify({ addLabelIds: add, removeLabelIds: remove }),
    });
  }

  async markRead(ctx: MailContext, messageId: string, read: boolean) {
    await this.modify(ctx, messageId, read ? [] : ['UNREAD'], read ? ['UNREAD'] : []);
  }

  async markImportant(ctx: MailContext, messageId: string, important: boolean) {
    await this.modify(ctx, messageId, important ? ['IMPORTANT'] : [], important ? [] : ['IMPORTANT']);
  }
}
