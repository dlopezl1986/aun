/**
 * Firebase client for AUN.
 *
 * Uses the Firebase JS SDK (modular, tree-shakeable). Auth state persists in
 * `browserLocalPersistence` on web and `asyncStorage` on native.
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile as fbUpdateProfile,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  collection,
  doc,
  getDocs,
  getFirestore,
  initializeFirestore,
  limit,
  orderBy,
  query,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
  /** Host of the local Firebase emulators (tests / development only). */
  emulatorHost?: string;
}

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

export function initFirebase(cfg: FirebaseConfig) {
  _app = initializeApp(cfg);
  _db = initializeFirestore(_app, {
    // Plain HTTP long polling: AUN only makes one-shot reads/writes (no live
    // listeners), and the default streaming connection can hang inside in-app
    // browsers (WhatsApp, Instagram…) and on some mobile networks/proxies.
    experimentalForceLongPolling: true,
  });
  _auth = getAuth(_app);
  if (cfg.emulatorHost) {
    connectAuthEmulator(_auth, `http://${cfg.emulatorHost}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(_db, cfg.emulatorHost, 8080);
  }
  setPersistence(_auth, browserLocalPersistence).catch(() => undefined);
}

export function firebaseAuth(): Auth {
  if (!_auth) throw new Error('Firebase not initialised — call initFirebase first');
  return _auth;
}

export function firebaseDb(): Firestore {
  if (!_db) throw new Error('Firebase not initialised — call initFirebase first');
  return _db;
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/** Wait for the first auth-state resolution (restoreSession). */
export function waitForUser(): Promise<User | null> {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(firebaseAuth(), (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

export {
  createUserWithEmailAndPassword,
  fbSignOut,
  fbUpdateProfile,
  GoogleAuthProvider,
  OAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
};

// ---------------------------------------------------------------------------
// Firestore helpers — the `records` collection
// ---------------------------------------------------------------------------

/**
 * Firestore stores AUN data in a flat `records` collection:
 *
 *   /records/{docId}
 *     ownerId: string          (== Firebase Auth uid)
 *     collection: string       (e.g. 'tasks', 'events', 'children')
 *     id: string               (local entity id)
 *     data: map                (the entity payload)
 *     updatedAt: string        (ISO client timestamp — LWW key)
 *     deletedAt: string|null
 *     serverUpdatedAt: Timestamp (Firestore server timestamp)
 *
 * Security: Firestore rules restrict every read/write to
 * `request.auth.uid == resource.data.ownerId`.
 */

export { collection, doc, getDocs, getFirestore, limit, orderBy, query, where, writeBatch };
