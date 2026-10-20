import AsyncStorage from '@react-native-async-storage/async-storage';

import type { KeyValueStore } from './keyValueStore';

/** AsyncStorage as a KeyValueStore (localStorage on the web). */
export const asyncStorageStore: KeyValueStore = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
  keys: async (prefix) => (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(prefix)),
};
