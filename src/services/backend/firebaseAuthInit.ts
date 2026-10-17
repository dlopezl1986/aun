import type { FirebaseApp } from 'firebase/app';
import { browserLocalPersistence, initializeAuth, type Auth } from 'firebase/auth';

/** Web: the session survives reloads in the browser's local storage. */
export function createFirebaseAuth(app: FirebaseApp): Auth {
  return initializeAuth(app, { persistence: browserLocalPersistence });
}
