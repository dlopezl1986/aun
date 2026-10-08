import * as SecureStore from 'expo-secure-store';

import type { SecureValueStore } from './secureStore.types';

/**
 * Native implementation (iOS Keychain / Android Keystore).
 * Use ONLY for small secrets: session tokens, OAuth refresh tokens…
 */
export const secureStore: SecureValueStore = {
  isPersistent: true,
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) =>
    SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    }),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};
