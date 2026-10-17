import { asyncKeyValueStore, storageKeys, type KeyValueStore } from '@/storage/keyValueStore';

/** Removes every value stored on this device for a user (data, sync state, preferences). */
export async function deleteLocalUserData(userId: string, store: KeyValueStore = asyncKeyValueStore): Promise<number> {
  const keys = (await store.keys?.(storageKeys.user(userId, ''))) ?? [];
  for (const key of keys) await store.removeItem(key);
  return keys.length;
}
