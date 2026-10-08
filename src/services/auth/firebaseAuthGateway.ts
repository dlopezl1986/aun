import { Platform } from 'react-native';

import {
  createUserWithEmailAndPassword,
  fbSignOut,
  fbUpdateProfile,
  firebaseAuth,
  GoogleAuthProvider,
  OAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  waitForUser,
} from '@/services/backend/firebase';
import {
  AuthError,
  type AuthGateway,
  type AuthMethod,
  type AuthMethodAvailability,
  type AuthSession,
  type AuthUser,
  type PasswordResetResult,
} from './types';

import type { User, UserCredential } from 'firebase/auth';

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

function toAuthUser(u: User): AuthUser {
  const providers = u.providerData
    .map((p) => {
      if (p.providerId === 'password') return 'password' as const;
      if (p.providerId === 'google.com') return 'google' as const;
      if (p.providerId === 'apple.com') return 'apple' as const;
      return null;
    })
    .filter((m): m is AuthMethod => m !== null);
  if (!providers.length) providers.push('password');
  return {
    id: u.uid,
    email: u.email ?? '',
    displayName: u.displayName || u.email?.split('@')[0] || 'AUN',
    avatarUrl: u.photoURL ?? null,
    methods: providers,
    createdAt: u.metadata.creationTime ?? new Date().toISOString(),
  };
}

function toAuthSession(u: User, method: AuthMethod): AuthSession {
  return { user: toAuthUser(u), method, issuedAt: new Date().toISOString() };
}

function mapError(e: unknown): AuthError {
  if (e instanceof AuthError) return e;
  const code = (e as { code?: string })?.code ?? '';
  const msg = e instanceof Error ? e.message : String(e);
  if (code.includes('email-already-in-use')) return new AuthError('email-in-use');
  if (code.includes('weak-password')) return new AuthError('weak-password');
  if (code.includes('invalid-email')) return new AuthError('invalid-email');
  if (code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential'))
    return new AuthError('invalid-credentials');
  if (code.includes('too-many-requests')) return new AuthError('rate-limited');
  if (code.includes('network-request-failed')) return new AuthError('network');
  if (code.includes('popup-closed') || code.includes('cancelled')) return new AuthError('cancelled');
  return new AuthError('unknown', msg);
}

// ---------------------------------------------------------------------------
// Gateway
// ---------------------------------------------------------------------------

export class FirebaseAuthGateway implements AuthGateway {
  readonly id = 'firebase';
  readonly isLocalOnly = false;
  readonly allowsUsername = false;

  constructor(private readonly providers: string[]) {}

  getAvailability(): AuthMethodAvailability[] {
    return [
      { method: 'password', available: true },
      {
        method: 'google',
        available: this.providers.includes('google'),
        reasonKey: 'auth.providerNotEnabled',
      },
      {
        method: 'apple',
        available: this.providers.includes('apple') && Platform.OS !== 'android',
        reasonKey: 'auth.providerNotEnabled',
      },
    ];
  }

  async restoreSession(): Promise<AuthSession | null> {
    const user = await waitForUser();
    return user ? toAuthSession(user, 'password') : null;
  }

  async signUpWithPassword(input: { email: string; password: string; displayName: string }): Promise<AuthSession> {
    try {
      const cred = await createUserWithEmailAndPassword(firebaseAuth(), input.email.trim().toLowerCase(), input.password);
      await fbUpdateProfile(cred.user, { displayName: input.displayName.trim() });
      return toAuthSession(cred.user, 'password');
    } catch (e) {
      throw mapError(e);
    }
  }

  async signInWithPassword(input: { email: string; password: string }): Promise<AuthSession> {
    try {
      const cred = await signInWithEmailAndPassword(firebaseAuth(), input.email.trim().toLowerCase(), input.password);
      return toAuthSession(cred.user, 'password');
    } catch (e) {
      throw mapError(e);
    }
  }

  async signInWithProvider(method: Exclude<AuthMethod, 'password'>): Promise<AuthSession> {
    if (!this.getAvailability().find((a) => a.method === method)?.available) throw new AuthError('method-unavailable');
    const provider = method === 'google' ? new GoogleAuthProvider() : new OAuthProvider('apple.com');
    try {
      const cred: UserCredential = await signInWithPopup(firebaseAuth(), provider);
      return toAuthSession(cred.user, method);
    } catch (e) {
      throw mapError(e);
    }
  }

  async requestPasswordReset(email: string): Promise<PasswordResetResult> {
    try {
      await sendPasswordResetEmail(firebaseAuth(), email.trim().toLowerCase());
      return { delivered: true };
    } catch (e) {
      throw mapError(e);
    }
  }

  async updateProfile(_userId: string, patch: { displayName?: string }): Promise<AuthUser> {
    const user = firebaseAuth().currentUser;
    if (!user) throw new AuthError('invalid-credentials');
    try {
      if (patch.displayName) await fbUpdateProfile(user, { displayName: patch.displayName.trim() });
      return toAuthUser(user);
    } catch (e) {
      throw mapError(e);
    }
  }

  async signOut(): Promise<void> {
    await fbSignOut(firebaseAuth());
  }
}
