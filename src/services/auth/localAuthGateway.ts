import { Platform } from 'react-native';

import { featureFlags } from '@/config/featureFlags';
import { asyncKeyValueStore, readJson, storageKeys, writeJson, type KeyValueStore } from '@/storage/keyValueStore';
import { secureStore } from '@/storage/secureStore';
import type { SecureValueStore } from '@/storage/secureStore.types';
import { createId } from '@/utils/id';
import { isValidLogin, normalizeEmail } from '@/utils/validation';
import { createSalt, hashPassword, PASSWORD_ITERATIONS, safeEqual } from './passwordHasher';
import { AuthError, type AuthGateway, type AuthMethod, type AuthMethodAvailability, type AuthSession, type AuthUser } from './types';

interface StoredAccount {
  user: AuthUser;
  salt: string;
  passwordHash: string;
  iterations: number;
}

const ACCOUNTS_KEY = storageKeys.auth('accounts');
const SESSION_KEY = 'aun.session';
export const MIN_PASSWORD_LENGTH = 8;

/**
 * On-device authentication used until the AUN backend exists (Phase 9).
 * Accounts are local to this device/browser. It is explicitly flagged as
 * local-only so the UI can inform the user.
 */
export class LocalAuthGateway implements AuthGateway {
  readonly id = 'local';
  readonly isLocalOnly = true;
  readonly allowsUsername = true;

  constructor(
    private readonly kv: KeyValueStore = asyncKeyValueStore,
    private readonly secure: SecureValueStore = secureStore,
  ) {}

  getAvailability(): AuthMethodAvailability[] {
    return [
      { method: 'password', available: true },
      {
        method: 'google',
        available: featureFlags.authGoogle,
        reasonKey: 'auth.providerRequiresBackend',
      },
      {
        method: 'apple',
        available: featureFlags.authApple && Platform.OS !== 'android',
        reasonKey: 'auth.providerRequiresBackend',
      },
    ];
  }

  private accounts(): Promise<StoredAccount[]> {
    return readJson<StoredAccount[]>(this.kv, ACCOUNTS_KEY, []);
  }

  /** Profiles of the accounts created on this device (never their password hashes). */
  async listLocalUsers(): Promise<AuthUser[]> {
    return (await this.accounts()).map((a) => a.user);
  }

  private async persistSession(user: AuthUser, method: AuthMethod): Promise<AuthSession> {
    const session: AuthSession = { user, method, issuedAt: new Date().toISOString() };
    // Only the user id + method is persisted; the profile is re-read on restore.
    await this.secure.setItem(SESSION_KEY, JSON.stringify({ userId: user.id, method, issuedAt: session.issuedAt }));
    return session;
  }

  async restoreSession(): Promise<AuthSession | null> {
    const raw = await this.secure.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      const ref = JSON.parse(raw) as { userId: string; method: AuthMethod; issuedAt: string };
      const account = (await this.accounts()).find((a) => a.user.id === ref.userId);
      if (!account) {
        await this.secure.removeItem(SESSION_KEY);
        return null;
      }
      return { user: account.user, method: ref.method, issuedAt: ref.issuedAt };
    } catch {
      await this.secure.removeItem(SESSION_KEY);
      return null;
    }
  }

  async signUpWithPassword(input: { email: string; password: string; displayName: string }): Promise<AuthSession> {
    // Local accounts may use a username ("ana_g") instead of an email.
    const email = normalizeEmail(input.email);
    if (!isValidLogin(email, true)) throw new AuthError('invalid-email');
    if (input.password.length < MIN_PASSWORD_LENGTH) throw new AuthError('weak-password');
    const accounts = await this.accounts();
    if (accounts.some((a) => a.user.email === email)) throw new AuthError('email-in-use');

    const salt = createSalt();
    const passwordHash = await hashPassword(input.password, salt, PASSWORD_ITERATIONS);
    const user: AuthUser = {
      id: createId(),
      email,
      displayName: input.displayName.trim() || email.split('@')[0],
      methods: ['password'],
      createdAt: new Date().toISOString(),
    };
    await writeJson(this.kv, ACCOUNTS_KEY, [...accounts, { user, salt, passwordHash, iterations: PASSWORD_ITERATIONS }]);
    return this.persistSession(user, 'password');
  }

  async signInWithPassword(input: { email: string; password: string }): Promise<AuthSession> {
    const email = normalizeEmail(input.email);
    const account = (await this.accounts()).find((a) => a.user.email === email);
    // Hash even when the account doesn't exist to keep timing uniform.
    const hash = await hashPassword(input.password, account?.salt ?? 'x', account?.iterations ?? PASSWORD_ITERATIONS);
    if (!account || !safeEqual(hash, account.passwordHash)) throw new AuthError('invalid-credentials');
    return this.persistSession(account.user, 'password');
  }

  async signInWithProvider(): Promise<AuthSession> {
    // Google / Apple sign-in needs a backend to verify ID tokens and issue
    // AUN sessions. We refuse explicitly instead of faking a login.
    throw new AuthError('requires-backend');
  }

  async requestPasswordReset(): Promise<{ delivered: boolean; reasonKey?: string }> {
    // Local accounts have no mail server; be honest with the user.
    return { delivered: false, reasonKey: 'auth.resetRequiresBackend' };
  }

  async updateProfile(userId: string, patch: { displayName?: string }): Promise<AuthUser> {
    const accounts = await this.accounts();
    const index = accounts.findIndex((a) => a.user.id === userId);
    if (index < 0) throw new AuthError('unknown');
    const user: AuthUser = {
      ...accounts[index].user,
      ...(patch.displayName !== undefined ? { displayName: patch.displayName.trim() } : {}),
    };
    const next = accounts.slice();
    next[index] = { ...accounts[index], user };
    await writeJson(this.kv, ACCOUNTS_KEY, next);
    return user;
  }

  async signOut(): Promise<void> {
    await this.secure.removeItem(SESSION_KEY);
  }
}
