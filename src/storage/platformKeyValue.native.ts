/**
 * iOS / Android: SQLite key/value store (expo-sqlite/kv-store). Unlike
 * AsyncStorage it has no 6 MB cap on Android. Data written by earlier
 * versions to AsyncStorage is moved here once, on first use.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Storage from 'expo-sqlite/kv-store';

import type { KeyValueStore } from './keyValueStore';

const PREFIX = 'aun:v1:';
/** Device preferences stay in AsyncStorage: state/appPreferences.ts reads them there directly. */
const DEVICE_PREFIX = 'aun:v1:device:';
const MIGRATED = 'aun:storage:sqlite-migrated';

let ready: Promise<void> | null = null;
function migrate(): Promise<void> {
  ready ??= (async () => {
    if (await Storage.getItem(MIGRATED)) return;
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIX) && !k.startsWith(DEVICE_PREFIX));
    for (const [key, value] of await AsyncStorage.multiGet(keys)) if (value !== null) await Storage.setItem(key, value);
    await Storage.setItem(MIGRATED, '1');
    if (keys.length) await AsyncStorage.multiRemove(keys);
  })();
  return ready;
}

export const platformKeyValueStore: KeyValueStore = {
  async getItem(key) {
    await migrate();
    return Storage.getItem(key);
  },
  async setItem(key, value) {
    await migrate();
    await Storage.setItem(key, value);
  },
  async removeItem(key) {
    await migrate();
    await Storage.removeItem(key);
  },
  async keys(prefix) {
    await migrate();
    return (await Storage.getAllKeys()).filter((k) => k.startsWith(prefix));
  },
};
