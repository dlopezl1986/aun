/**
 * Compile-time feature flags. Integrations that require secrets or a backend
 * stay OFF until they are really implemented — the UI reads these flags to
 * show an honest "not available yet" state instead of fake buttons.
 *
 * Later these can be merged with remote flags / plan entitlements.
 */
export const featureFlags = {
  authGoogle: false,
  authApple: false,
  // Shipped; availability also depends on platform + OAuth client config (googleOAuth.ts).
  storageGoogleDrive: true,
  storageICloud: false,
  // Shipped; availability depends on platform + OAuth client config (oauthClient.ts).
  emailGmail: true,
  emailOutlook: true,
  /** Local demo mailbox for QA — development builds only. */
  emailDemo: __DEV__,
  ai: false,
  globalSearch: true,
} as const;

export type FeatureFlag = keyof typeof featureFlags;

/** Public, non-secret configuration read from EXPO_PUBLIC_* env vars. */
export const appConfig = {
  env: process.env.EXPO_PUBLIC_APP_ENV ?? 'development',
  // OAuth *client IDs* are public identifiers (not secrets). Client secrets
  // must never be shipped in the app — they belong to the backend.
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
  googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '',
  microsoftClientId: process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID ?? '',
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? '',
  // Backend (Phase 9). The anon key is a PUBLIC key by design: every table is
  // protected by Row Level Security. Never put the service_role key here.
  supabaseUrl: (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, ''),
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  /** The backend accepts usernames as well as emails (AUN local server). */
  authAllowUsername: process.env.EXPO_PUBLIC_AUTH_ALLOW_USERNAME === '1',
  /** Social sign-in providers enabled in the backend, e.g. "google,apple". */
  authProviders: (process.env.EXPO_PUBLIC_AUTH_PROVIDERS ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean),
  // Firebase (alternative to Supabase). All values are PUBLIC identifiers
  // (the Firebase web config object). Security lives in Firestore rules.
  firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
};
