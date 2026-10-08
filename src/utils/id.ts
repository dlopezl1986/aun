import * as Crypto from 'expo-crypto';

/** RFC 4122 v4 UUID, generated client-side (works offline, sync-friendly). */
export function createId(): string {
  return Crypto.randomUUID();
}
