import { create } from 'zustand';

import { authGateway, type AuthMethod, type AuthSession, type AuthUser } from '@/services/auth';

type AuthStatus = 'initializing' | 'signedOut' | 'signedIn';

interface AuthState {
  status: AuthStatus;
  session: AuthSession | null;
  bootstrap: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: { email: string; password: string; displayName: string }) => Promise<void>;
  signInWithProvider: (method: Exclude<AuthMethod, 'password'>) => Promise<void>;
  updateProfile: (patch: { displayName?: string }) => Promise<AuthUser>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  status: 'initializing',
  session: null,
  async bootstrap() {
    try {
      const session = await authGateway.restoreSession();
      set({ session, status: session ? 'signedIn' : 'signedOut' });
    } catch {
      set({ session: null, status: 'signedOut' });
    }
  },
  async signIn(email, password) {
    const session = await authGateway.signInWithPassword({ email, password });
    set({ session, status: 'signedIn' });
  },
  async signUp(input) {
    const session = await authGateway.signUpWithPassword(input);
    set({ session, status: 'signedIn' });
  },
  async signInWithProvider(method) {
    const session = await authGateway.signInWithProvider(method);
    set({ session, status: 'signedIn' });
  },
  async updateProfile(patch) {
    const current = get().session;
    if (!current) throw new Error('No session');
    const user = await authGateway.updateProfile(current.user.id, patch);
    set({ session: { ...current, user } });
    return user;
  },
  async signOut() {
    await authGateway.signOut();
    set({ session: null, status: 'signedOut' });
  },
}));

/** Current user — only call inside the authenticated area. */
export function useCurrentUser(): AuthUser {
  const user = useAuthStore((s) => s.session?.user);
  if (!user) throw new Error('useCurrentUser must be used inside the authenticated app');
  return user;
}
