/**
 * Engine-independent UTF-8 + Base64 helpers (Hermes, JSC and browsers),
 * used to build and read MIME e-mail bodies. Pure functions, unit tested.
 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = new Map([...ALPHABET].map((c, i) => [c, i]));

export function utf8Encode(text: string): Uint8Array {
  const out: number[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
  }
  return Uint8Array.from(out);
}

export function utf8Decode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length;) {
    const b = bytes[i];
    let cp: number;
    if (b < 0x80) {
      cp = b;
      i += 1;
    } else if (b >> 5 === 6) {
      cp = ((b & 31) << 6) | (bytes[i + 1] & 63);
      i += 2;
    } else if (b >> 4 === 14) {
      cp = ((b & 15) << 12) | ((bytes[i + 1] & 63) << 6) | (bytes[i + 2] & 63);
      i += 3;
    } else {
      cp = ((b & 7) << 18) | ((bytes[i + 1] & 63) << 12) | ((bytes[i + 2] & 63) << 6) | (bytes[i + 3] & 63);
      i += 4;
    }
    out += String.fromCodePoint(Number.isFinite(cp) ? cp : 0xfffd);
  }
  return out;
}

/** Latin-1 decoding (charset=iso-8859-1 / windows-1252 parts). */
export function latin1Decode(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += String.fromCharCode(b);
  return out;
}

export function base64Encode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const [a, b = 0, c = 0] = [bytes[i], bytes[i + 1], bytes[i + 2]];
    const n = (a << 16) | (b << 8) | c;
    out += ALPHABET[(n >> 18) & 63] + ALPHABET[(n >> 12) & 63];
    out += i + 1 < bytes.length ? ALPHABET[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? ALPHABET[n & 63] : '=';
  }
  return out;
}

export function base64Decode(input: string): Uint8Array {
  const clean = input
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .replace(/[^A-Za-z0-9+/]/g, '');
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const chunk = [0, 1, 2, 3].map((k) => LOOKUP.get(clean[i + k]) ?? -1);
    const n = (Math.max(chunk[0], 0) << 18) | (Math.max(chunk[1], 0) << 12) | (Math.max(chunk[2], 0) << 6) | Math.max(chunk[3], 0);
    out.push((n >> 16) & 255);
    if (chunk[2] >= 0) out.push((n >> 8) & 255);
    if (chunk[3] >= 0) out.push(n & 255);
  }
  return Uint8Array.from(out);
}

/** URL-safe Base64 without padding (Gmail `raw`, JWT…). */
export const base64UrlEncode = (bytes: Uint8Array) => base64Encode(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const textToBase64Url = (text: string) => base64UrlEncode(utf8Encode(text));
export const base64UrlToText = (data: string) => utf8Decode(base64Decode(data));
