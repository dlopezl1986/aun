/**
 * IndexedDB key/value store (web). localStorage (what AsyncStorage uses on the
 * web) is capped at ~5 MB per site, which a family's calendars, tasks and
 * documents outgrow; IndexedDB is not. Values written by earlier versions to
 * localStorage are moved here once.
 */
import type { KeyValueStore } from './keyValueStore';

const PREFIX = 'aun:v1:';
/** Device preferences stay in AsyncStorage: state/appPreferences.ts reads them there directly. */
const DEVICE_PREFIX = 'aun:v1:device:';
const DB = 'aun';
const STORE = 'kv';
const MIGRATED = 'aun:storage:idb-migrated';
const NO_DB = Symbol('no-indexeddb');

const request = <T>(r: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

function openDb(factory: IDBFactory): Promise<IDBDatabase> {
  const r = factory.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(STORE);
  return request(r);
}

/** Some browsers (old Safari, locked-down profiles) never answer `indexedDB.open`. */
const OPEN_TIMEOUT_MS = 4_000;

/**
 * An IndexedDB store over `factory`, migrating from `legacy`. If IndexedDB
 * cannot be opened (error or no answer), every call goes to `fallback`
 * instead of leaving the app waiting forever.
 */
export function createIndexedDbStore(factory: IDBFactory, legacy: Storage | null, fallback?: KeyValueStore): KeyValueStore {
  let db: Promise<IDBDatabase | null> | null = null;
  const open = () =>
    (db ??= Promise.race([
      openDb(factory).then(async (d) => {
        await migrate(d);
        return d;
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), OPEN_TIMEOUT_MS)),
    ]).catch(() => null));
  const tx = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | typeof NO_DB> => {
    const d = await open();
    if (!d) return NO_DB;
    return request(fn(d.transaction(STORE, mode).objectStore(STORE)));
  };

  async function migrate(d: IDBDatabase) {
    const store = () => d.transaction(STORE, 'readwrite').objectStore(STORE);
    if ((await request(store().get(MIGRATED))) || !legacy) {
      await request(store().put('1', MIGRATED));
      return;
    }
    const keys: string[] = [];
    for (let i = 0; i < legacy.length; i++) {
      const k = legacy.key(i);
      if (k?.startsWith(PREFIX) && !k.startsWith(DEVICE_PREFIX)) keys.push(k);
    }
    const s = store();
    for (const k of keys) s.put(legacy.getItem(k), k);
    await request(s.put('1', MIGRATED));
    keys.forEach((k) => legacy.removeItem(k));
  }

  const noDb = () => {
    if (!fallback) throw new Error('IndexedDB is not available');
    return fallback;
  };
  return {
    async getItem(key) {
      const v = await tx('readonly', (s) => s.get(key));
      return v === NO_DB ? noDb().getItem(key) : ((v as string | undefined) ?? null);
    },
    async setItem(key, value) {
      if ((await tx('readwrite', (s) => s.put(value, key))) === NO_DB) await noDb().setItem(key, value);
    },
    async removeItem(key) {
      if ((await tx('readwrite', (s) => s.delete(key))) === NO_DB) await noDb().removeItem(key);
    },
    async keys(prefix) {
      const all = await tx('readonly', (s) => s.getAllKeys());
      if (all === NO_DB) return (await noDb().keys?.(prefix)) ?? [];
      return (all as IDBValidKey[]).filter((k): k is string => typeof k === 'string' && k.startsWith(prefix));
    },
  };
}
