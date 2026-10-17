/**
 * Default store: AsyncStorage. Platform versions: IndexedDB on the web
 * (platformKeyValue.web.ts) and SQLite on iOS / Android (.native.ts).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { KeyValueStore } from './keyValueStore';

export const asyncStorageStore: KeyValueStore = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
  keys: async (prefix) => (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(prefix)),
};

export const platformKeyValueStore: KeyValueStore = asyncStorageStore;
