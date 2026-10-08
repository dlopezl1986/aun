/**
 * Firebase client for AUN.
 *
 * Uses the Firebase JS SDK (modular, tree-shakeable). Auth state persists in
 * `browserLocalPersistence` on web and `asyncStorage` on native.
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
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
}

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

export function initFirebase(cfg: FirebaseConfig) {
  _app = initializeApp(cfg);
  _db = initializeFirestore(_app, {
    // Reduce cold-start latency for short-lived sessions (web PWA).
    experimentalForceLongPolling: false,
  });
  _auth = getAuth(_app);
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
