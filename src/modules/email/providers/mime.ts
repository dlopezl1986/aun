import { base64Encode, utf8Encode } from '@/utils/base64';
import type { EmailAddress } from '../types';

/** RFC 2047 encoded-word for non-ASCII header values. */
export function encodeHeader(value: string): string {
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${base64Encode(utf8Encode(value))}?=`;
}

export function formatAddress(a: EmailAddress): string {
  if (!a.name) return a.address;
  const name = /^[\x00-\x7F]*$/.test(a.name) ? `"${a.name.replace(/"/g, "'")}"` : encodeHeader(a.name);
  return `${name} <${a.address}>`;
}

export interface MimeInput {
  from?: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
}

/** A plain-text UTF-8 RFC 5322 message (CRLF line endings, base64 body). */
export function buildMime(m: MimeInput): string {
  const headers = [
    m.from ? `From: ${formatAddress(m.from)}` : null,
    `To: ${m.to.map(formatAddress).join(', ')}`,
    m.cc?.length ? `Cc: ${m.cc.map(formatAddress).join(', ')}` : null,
    `Subject: ${encodeHeader(m.subject)}`,
    m.inReplyTo ? `In-Reply-To: ${m.inReplyTo}` : null,
    m.references ? `References: ${m.references}` : null,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
  ].filter(Boolean);
  const body = base64Encode(utf8Encode(m.body)).replace(/.{1,76}/g, '$&\r\n');
  return `${headers.join('\r\n')}\r\n\r\n${body}`;
}

/** "Re: " / "Fwd: " without stacking prefixes. */
export function prefixSubject(prefix: 'Re' | 'Fwd', subject: string): string {
  const re = prefix === 'Re' ? /^(re|aw|rv)\s*:/i : /^(fwd?|rv|wg)\s*:/i;
  return re.test(subject.trim()) ? subject : `${prefix}: ${subject}`;
}
