/**
 * Web: IndexedDB (no ~5 MB cap like localStorage). Without IndexedDB (very
 * old or locked-down browsers) it falls back to localStorage.
 */
import { createIndexedDbStore } from './indexedDbStore';
import type { KeyValueStore } from './keyValueStore';
import { asyncStorageStore } from './platformKeyValue';

function legacyStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export const platformKeyValueStore: KeyValueStore =
  typeof indexedDB !== 'undefined' ? createIndexedDbStore(indexedDB, legacyStorage()) : asyncStorageStore;

// Ask the browser not to evict AUN's data under storage pressure (best effort).
if (typeof navigator !== 'undefined' && navigator.storage?.persist) void navigator.storage.persist().catch(() => undefined);
