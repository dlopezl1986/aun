import { Platform } from 'react-native';

import { appConfig } from '@/config/featureFlags';
import { secureStore } from '@/storage/secureStore';
import { SupabaseClient } from './supabase';

/**
 * A server on "localhost" (the AUN local server) is reached through the same
 * host the web app was opened from, so another computer or phone on the
 * network that opens http://<this-mac>:8090 also reaches http://<this-mac>:8091.
 */
function resolveUrl(url: string): string {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return url;
  return url.replace(/\/\/(localhost|127\.0\.0\.1)(?=[:/]|$)/, `//${window.location.hostname}`);
}

// ---------------------------------------------------------------------------
// Backend mode: Firebase > Supabase > local-only
// ---------------------------------------------------------------------------

/** 'firebase' | 'supabase' | 'local' — determined at build time from env. */
export type BackendKind = 'firebase' | 'supabase' | 'local';

export const backendKind: BackendKind = appConfig.firebaseApiKey
  ? 'firebase'
  : appConfig.supabaseUrl && appConfig.supabaseAnonKey
    ? 'supabase'
    : 'local';

/**
 * The Supabase client, when that backend is active.
 * Firebase mode and local-only mode both leave this `null`.
 */
export const backend: SupabaseClient | null =
  backendKind === 'supabase'
    ? new SupabaseClient({ url: resolveUrl(appConfig.supabaseUrl), anonKey: appConfig.supabaseAnonKey }, secureStore)
    : null;

export const isBackendConfigured = backendKind !== 'local';
