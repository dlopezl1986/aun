import { platformKeyValueStore } from './platformKeyValue';

/**
 * Minimal key/value contract used by every local persistence adapter:
 * IndexedDB on the web and SQLite on iOS / Android (platformKeyValue*.ts).
 */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  /** Keys starting with `prefix` (to delete everything of a user). */
  keys?(prefix: string): Promise<string[]>;
}

export const asyncKeyValueStore: KeyValueStore = platformKeyValueStore;

/** Namespacing helpers so data never collides between users or schema versions. */
export const storageKeys = {
  prefix: 'aun:v1',
  device: (name: string) => `aun:v1:device:${name}`,
  auth: (name: string) => `aun:v1:auth:${name}`,
  user: (userId: string, name: string) => `aun:v1:u:${userId}:${name}`,
};

export async function readJson<T>(store: KeyValueStore, key: string, fallback: T): Promise<T> {
  const raw = await store.getItem(key);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(store: KeyValueStore, key: string, value: unknown): Promise<void> {
  return store.setItem(key, JSON.stringify(value));
}
