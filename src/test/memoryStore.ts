import type { KeyValueStore } from '@/storage/keyValueStore';

/** In-memory KeyValueStore for unit tests. */
export function memoryStore(): KeyValueStore & { dump: () => Record<string, string> } {
  const data = new Map<string, string>();
  return {
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => {
      data.set(k, v);
    },
    removeItem: async (k) => {
      data.delete(k);
    },
    dump: () => Object.fromEntries(data),
  };
}

let counter = 0;
/** Deterministic ids for tests (replaces expo-crypto's randomUUID). */
export const nextId = () => `id-${++counter}`;
