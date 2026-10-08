import type { SecureValueStore } from './secureStore.types';

/**
 * Web has no OS keychain. Browser storage is readable by any script on the
 * origin, so it MUST NOT hold third-party OAuth tokens (Google, Microsoft…).
 * Those will live server-side (httpOnly cookie session) once the backend
 * exists — see docs/SECURITY.md.
 *
 * For the local MVP we only persist the opaque local session reference here.
 */
const memory = new Map<string, string>();

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export const secureStore: SecureValueStore = {
  isPersistent: false,
  async getItem(key) {
    return storage()?.getItem(key) ?? memory.get(key) ?? null;
  },
  async setItem(key, value) {
    const s = storage();
    if (s) s.setItem(key, value);
    else memory.set(key, value);
  },
  async removeItem(key) {
    storage()?.removeItem(key);
    memory.delete(key);
  },
};
