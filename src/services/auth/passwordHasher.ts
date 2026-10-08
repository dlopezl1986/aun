import * as Crypto from 'expo-crypto';

/**
 * Local password hashing for the on-device MVP accounts.
 *
 * Passwords are never stored in plain text: we store a random 128-bit salt
 * and an iterated, salted SHA-256 digest. This is adequate for protecting a
 * local profile on a personal device; it is NOT a substitute for server-side
 * hashing (argon2id/bcrypt) which the remote AuthGateway will use.
 */
const ITERATIONS = 2000;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function createSalt(): string {
  return toHex(Crypto.getRandomBytes(16));
}

export async function hashPassword(password: string, salt: string, iterations = ITERATIONS): Promise<string> {
  let digest = `${salt}:${password}`;
  for (let i = 0; i < iterations; i += 1) {
    digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}${digest}`);
  }
  return digest;
}

/** Constant-time comparison to avoid timing leaks. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const PASSWORD_ITERATIONS = ITERATIONS;
