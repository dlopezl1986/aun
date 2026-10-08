import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import {
  NetworkError,
  SupabaseHttpError,
  toSession,
  type StoredSession,
  type SupabaseClient,
  type SupabaseUser,
} from '@/services/backend/supabase';
import { normalizeEmail } from '@/utils/validation';
import {
  AuthError,
  type AuthGateway,
  type AuthMethod,
  type AuthMethodAvailability,
  type AuthSession,
  type AuthUser,
  type PasswordResetResult,
} from './types';

const PROVIDER_NAMES: Record<Exclude<AuthMethod, 'password'>, string> = { google: 'google', apple: 'apple' };

export function toAuthUser(u: SupabaseUser): AuthUser {
  const providers = u.app_metadata?.providers ?? (u.app_metadata?.provider ? [u.app_metadata.provider] : ['email']);
  const email = u.email ?? '';
  return {
    id: u.id,
    email,
    displayName: u.user_metadata?.display_name || u.user_metadata?.full_name || u.user_metadata?.name || email.split('@')[0] || 'AUN',
    avatarUrl: u.user_metadata?.avatar_url ?? null,
    methods: providers
      .map((p) => (p === 'email' ? 'password' : p))
      .filter((p): p is AuthMethod => ['password', 'google', 'apple'].includes(p)),
    createdAt: u.created_at ?? new Date().toISOString(),
  };
}

function mapError(e: unknown): AuthError {
  if (e instanceof AuthError) return e;
  if (e instanceof NetworkError) return new AuthError('network');
  if (e instanceof SupabaseHttpError) {
    const text = `${e.code} ${e.message}`.toLowerCase();
    if (text.includes('email_not_confirmed') || text.includes('not confirmed')) return new AuthError('email-not-confirmed');
    if (text.includes('invalid_credentials') || text.includes('invalid login') || text.includes('invalid_grant'))
      return new AuthError('invalid-credentials');
    if (text.includes('already') || text.includes('user_already_exists') || text.includes('email_exists'))
      return new AuthError('email-in-use');
    if (text.includes('weak_password') || text.includes('password should')) return new AuthError('weak-password');
    if (text.includes('email_address_invalid') || text.includes('invalid email')) return new AuthError('invalid-email');
    if (e.status === 429) return new AuthError('rate-limited');
  }
  return new AuthError('unknown', e instanceof Error ? e.message : String(e));
}

/**
 * Accounts in the AUN backend (Supabase Auth): email + password with email
 * confirmation and password recovery, plus Google / Apple through the
 * backend's OAuth (AUN never sees the Google/Apple password).
 */
export class SupabaseAuthGateway implements AuthGateway {
  readonly id = 'supabase';
  readonly isLocalOnly = false;
  /** A real Supabase needs emails (confirmation, recovery); the AUN local server also accepts usernames. */
  readonly allowsUsername: boolean;

  constructor(
    private readonly client: SupabaseClient,
    private readonly providers: string[],
    allowUsername = false,
  ) {
    this.allowsUsername = allowUsername;
  }

  getAvailability(): AuthMethodAvailability[] {
    return [
      { method: 'password', available: true },
      { method: 'google', available: this.providers.includes('google'), reasonKey: 'auth.providerNotEnabled' },
      { method: 'apple', available: this.providers.includes('apple') && Platform.OS !== 'android', reasonKey: 'auth.providerNotEnabled' },
    ];
  }

  private async toAuthSession(s: StoredSession, method: AuthMethod): Promise<AuthSession> {
    await this.client.setSession(s);
    return { user: toAuthUser(s.user), method, issuedAt: new Date().toISOString() };
  }

  async restoreSession(): Promise<AuthSession | null> {
    const stored = await this.client.getSession();
    if (!stored) return null;
    try {
      const user = await this.client.authed<SupabaseUser>('/auth/v1/user');
      const session = (await this.client.getSession())!;
      await this.client.setSession({ ...session, user });
      return { user: toAuthUser(user), method: 'password', issuedAt: new Date().toISOString() };
    } catch (e) {
      // Offline: keep the user signed in with the cached profile.
      if (e instanceof NetworkError) return { user: toAuthUser(stored.user), method: 'password', issuedAt: new Date().toISOString() };
      await this.client.setSession(null);
      return null;
    }
  }

  async signUpWithPassword(input: { email: string; password: string; displayName: string }): Promise<AuthSession> {
    try {
      const r = await this.client.request<
        Partial<{ access_token: string; refresh_token: string; expires_in: number; user: SupabaseUser }> & SupabaseUser
      >('/auth/v1/signup', {
        method: 'POST',
        body: JSON.stringify({
          email: normalizeEmail(input.email),
          password: input.password,
          data: { display_name: input.displayName.trim() },
        }),
      });
      // With email confirmation enabled there is no session until the link is opened.
      if (!r.access_token || !r.refresh_token || !r.user) throw new AuthError('confirmation-sent');
      return this.toAuthSession(
        toSession({ access_token: r.access_token, refresh_token: r.refresh_token, expires_in: r.expires_in, user: r.user }),
        'password',
      );
    } catch (e) {
      throw mapError(e);
    }
  }

  async signInWithPassword(input: { email: string; password: string }): Promise<AuthSession> {
    try {
      const r = await this.client.request<Parameters<typeof toSession>[0]>('/auth/v1/token?grant_type=password', {
        method: 'POST',
        body: JSON.stringify({ email: normalizeEmail(input.email), password: input.password }),
      });
      return this.toAuthSession(toSession(r), 'password');
    } catch (e) {
      throw mapError(e);
    }
  }

  async signInWithProvider(method: Exclude<AuthMethod, 'password'>): Promise<AuthSession> {
    if (!this.getAvailability().find((a) => a.method === method)?.available) throw new AuthError('method-unavailable');
    const redirect = Platform.OS === 'web' ? window.location.origin : Linking.createURL('auth/callback');
    const url = `${this.client.config.url}/auth/v1/authorize?provider=${PROVIDER_NAMES[method]}&redirect_to=${encodeURIComponent(redirect)}`;
    const result = await WebBrowser.openAuthSessionAsync(url, redirect);
    if (result.type !== 'success') throw new AuthError('cancelled');
    const params = new URLSearchParams(result.url.split('#')[1] ?? '');
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (!accessToken || !refreshToken) throw new AuthError('unknown', params.get('error_description') ?? 'No tokens');
    try {
      const user = await this.client.request<SupabaseUser>('/auth/v1/user', { token: accessToken });
      return this.toAuthSession(
        toSession({ access_token: accessToken, refresh_token: refreshToken, expires_in: Number(params.get('expires_in') ?? 3600), user }),
        method,
      );
    } catch (e) {
      throw mapError(e);
    }
  }

  async requestPasswordReset(email: string): Promise<PasswordResetResult> {
    try {
      await this.client.request('/auth/v1/recover', { method: 'POST', body: JSON.stringify({ email: normalizeEmail(email) }) });
      // Same answer whether the account exists or not (no account enumeration).
      return { delivered: true };
    } catch (e) {
      throw mapError(e);
    }
  }

  async updateProfile(_userId: string, patch: { displayName?: string }): Promise<AuthUser> {
    try {
      const user = await this.client.authed<SupabaseUser>('/auth/v1/user', {
        method: 'PUT',
        body: JSON.stringify({ data: { display_name: patch.displayName?.trim() } }),
      });
      const s = await this.client.getSession();
      if (s) await this.client.setSession({ ...s, user });
      return toAuthUser(user);
    } catch (e) {
      throw mapError(e);
    }
  }

  async signOut(): Promise<void> {
    try {
      await this.client.authed('/auth/v1/logout', { method: 'POST' });
    } catch {
      // Already invalid / offline: forget it locally anyway.
    }
    await this.client.setSession(null);
  }
}
