import { EmailError, type MailContext } from '../types';

/**
 * Authorised JSON request against a mail API. Retries once with a refreshed
 * token on 401 and maps HTTP failures to `EmailError` codes.
 */
export async function mailFetch<T>(ctx: MailContext, url: string, init: RequestInit = {}): Promise<T> {
  const run = async (token: string) => {
    try {
      return await fetch(url, {
        ...init,
        headers: {
          ...(init.body && typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
          ...(init.headers ?? {}),
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (e) {
      throw new EmailError('network', e instanceof Error ? e.message : String(e));
    }
  };
  let res = await run(await ctx.getToken());
  if (res.status === 401) res = await run(await ctx.getToken(true));
  if (!res.ok) {
    let detail = '';
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      // no JSON body
    }
    if (res.status === 401 || res.status === 403) throw new EmailError('auth-expired', detail);
    if (res.status === 404) throw new EmailError('not-found', detail);
    if (res.status === 429) throw new EmailError('rate-limited', detail);
    if (res.status === 400) throw new EmailError('invalid', detail);
    throw new EmailError('unknown', `${res.status} ${detail}`);
  }
  if (res.status === 202 || res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** "Ana Pérez <ana@x.com>, bob@y.com" → addresses (also accepts ";" separators). */
export function parseAddressList(value: string | undefined | null): { name?: string; address: string }[] {
  if (!value) return [];
  const out: { name?: string; address: string }[] = [];
  // Split on commas/semicolons that are not inside quotes or angle brackets.
  let current = '';
  let quoted = false;
  let angle = false;
  for (const ch of value) {
    if (ch === '"') quoted = !quoted;
    if (ch === '<') angle = true;
    if (ch === '>') angle = false;
    if ((ch === ',' || ch === ';') && !quoted && !angle) {
      if (current.trim()) out.push(parseAddress(current));
      current = '';
    } else current += ch;
  }
  if (current.trim()) out.push(parseAddress(current));
  return out.filter((a) => a.address);
}

export function parseAddress(raw: string): { name?: string; address: string } {
  const s = raw.trim();
  const m = s.match(/^(.*)<([^>]+)>\s*$/);
  if (m) {
    const name = m[1]
      .trim()
      .replace(/^"(.*)"$/, '$1')
      .trim();
    return name ? { name, address: m[2].trim() } : { address: m[2].trim() };
  }
  return { address: s.replace(/^"(.*)"$/, '$1') };
}

export const isEmail = (v: string) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v.trim());

/** Plain-text version of an HTML body (quotes, previews, native fallback). */
export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script|head)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** "> " quoted original for replies and forwards (plain text). */
export function quoteOriginal(header: string, text: string): string {
  return `\n\n${header}\n${text
    .split('\n')
    .map((l) => `> ${l}`)
    .join('\n')}`;
}

/** "Reply all" recipients: everyone in To/Cc except me and the original sender (who goes in To). */
export function replyAllCc(
  original: { from: { address: string }; to: { name?: string; address: string }[]; cc: { name?: string; address: string }[] },
  me: string,
) {
  const skip = new Set([me.toLowerCase(), original.from.address.toLowerCase()]);
  const seen = new Set<string>();
  return [...original.to, ...original.cc].filter((a) => {
    const k = a.address.toLowerCase();
    if (skip.has(k) || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
