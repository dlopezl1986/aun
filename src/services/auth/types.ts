export type AuthMethod = 'password' | 'google' | 'apple';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  methods: AuthMethod[];
  createdAt: string;
}

export interface AuthSession {
  user: AuthUser;
  method: AuthMethod;
  issuedAt: string;
}

export type AuthErrorCode =
  | 'invalid-credentials'
  | 'email-in-use'
  | 'weak-password'
  | 'invalid-email'
  | 'method-unavailable'
  | 'requires-backend'
  | 'email-not-confirmed'
  | 'confirmation-sent'
  | 'rate-limited'
  | 'network'
  | 'cancelled'
  | 'unknown';

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'AuthError';
  }
}

export interface AuthMethodAvailability {
  method: AuthMethod;
  available: boolean;
  /** i18n key explaining why a method is not available yet. */
  reasonKey?: string;
}

export interface PasswordResetResult {
  delivered: boolean;
  reasonKey?: string;
}

/**
 * Contract every authentication backend must fulfil. The UI and state only
 * talk to this interface. Phase 1 ships `LocalAuthGateway`; Phase 9 will add
 * a remote gateway (e.g. Supabase / custom API) with real OAuth providers.
 */
export interface AuthGateway {
  readonly id: string;
  /** True when accounts only exist on this device (development/MVP mode). */
  readonly isLocalOnly: boolean;
  /** Accounts may be identified by a username instead of an email (local mode only). */
  readonly allowsUsername: boolean;
  getAvailability(): AuthMethodAvailability[];
  restoreSession(): Promise<AuthSession | null>;
  signUpWithPassword(input: { email: string; password: string; displayName: string }): Promise<AuthSession>;
  signInWithPassword(input: { email: string; password: string }): Promise<AuthSession>;
  signInWithProvider(method: Exclude<AuthMethod, 'password'>): Promise<AuthSession>;
  requestPasswordReset(email: string): Promise<PasswordResetResult>;
  updateProfile(userId: string, patch: { displayName?: string }): Promise<AuthUser>;
  signOut(): Promise<void>;
}
