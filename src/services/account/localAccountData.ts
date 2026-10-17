import AsyncStorage from '@react-native-async-storage/async-storage';

import { storageKeys } from '@/storage/keyValueStore';

/** Removes every value stored on this device for a user (data, sync state, preferences). */
export async function deleteLocalUserData(userId: string): Promise<number> {
  const prefix = storageKeys.user(userId, '');
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(prefix));
  if (keys.length) await AsyncStorage.multiRemove(keys);
  return keys.length;
}
