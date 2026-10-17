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

/** Exported for tests: an IndexedDB store over `factory`, migrating from `legacy`. */
export function createIndexedDbStore(factory: IDBFactory, legacy: Storage | null): KeyValueStore {
  let db: Promise<IDBDatabase> | null = null;
  const tx = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    db ??= openDb(factory).then(async (d) => {
      await migrate(d);
      return d;
    });
    const store = (await db).transaction(STORE, mode).objectStore(STORE);
    return request(fn(store));
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

  return {
    async getItem(key) {
      return ((await tx('readonly', (s) => s.get(key))) as string | undefined) ?? null;
    },
    async setItem(key, value) {
      await tx('readwrite', (s) => s.put(value, key));
    },
    async removeItem(key) {
      await tx('readwrite', (s) => s.delete(key));
    },
    async keys(prefix) {
      const all = (await tx('readonly', (s) => s.getAllKeys())) as string[];
      return all.filter((k) => typeof k === 'string' && k.startsWith(prefix));
    },
  };
}
