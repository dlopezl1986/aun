import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FirebaseApp } from 'firebase/app';
import { initializeAuth, type Auth, type Persistence } from 'firebase/auth';

// Only in the React Native build of firebase/auth (not in its web typings).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getReactNativePersistence } = require('firebase/auth') as {
  getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
};

/** iOS / Android: keep the session on the device, so the app opens signed in. */
export function createFirebaseAuth(app: FirebaseApp): Auth {
  return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
}
