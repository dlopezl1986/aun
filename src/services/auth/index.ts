import { appConfig } from '@/config/featureFlags';
import { backend, backendKind } from '@/services/backend';
import { FirebaseAuthGateway } from './firebaseAuthGateway';
import { LocalAuthGateway } from './localAuthGateway';
import { SupabaseAuthGateway } from './supabaseAuthGateway';
import type { AuthGateway } from './types';

export * from './types';
export { MIN_PASSWORD_LENGTH } from './localAuthGateway';

// ---------------------------------------------------------------------------
// Init Firebase if that's the chosen backend (must happen before any
// Firebase Auth call, i.e. before the gateway is used).
// ---------------------------------------------------------------------------
if (backendKind === 'firebase') {
  // Dynamic import so firebase/app is not loaded at all in Supabase/local mode.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { initFirebase } = require('@/services/backend/firebase') as typeof import('@/services/backend/firebase');
  initFirebase({
    apiKey: appConfig.firebaseApiKey,
    authDomain: appConfig.firebaseAuthDomain,
    projectId: appConfig.firebaseProjectId,
    storageBucket: appConfig.firebaseStorageBucket,
    messagingSenderId: appConfig.firebaseMessagingSenderId,
    appId: appConfig.firebaseAppId,
  });
}

/**
 * Single place where the active auth backend is chosen:
 *   Firebase > Supabase > local-only.
 */
function createAuthGateway(): AuthGateway {
  if (backendKind === 'firebase') return new FirebaseAuthGateway(appConfig.authProviders);
  if (backend) return new SupabaseAuthGateway(backend, appConfig.authProviders, appConfig.authAllowUsername);
  return new LocalAuthGateway();
}

export const authGateway: AuthGateway = createAuthGateway();

/** Local accounts stay readable to offer "copy this device's data to my account". */
export const localAccounts = new LocalAuthGateway();
