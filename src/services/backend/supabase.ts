import type { SecureValueStore } from '@/storage/secureStore.types';

/**
 * Minimal Supabase client over its public REST APIs (GoTrue auth + PostgREST).
 * No SDK dependency: AUN only needs a handful of calls, and keeping them here
 * makes the backend replaceable (a custom API only has to offer the same).
 */
export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export interface SupabaseUser {
  id: string;
  email?: string;
  created_at?: string;
  user_metadata?: { display_name?: string; full_name?: string; name?: string; avatar_url?: string };
  app_metadata?: { provider?: string; providers?: string[] };
}

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms. */
  expiresAt: number;
  user: SupabaseUser;
}

export class SupabaseHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'SupabaseHttpError';
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

const SESSION_KEY = 'aun.backend.session';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
  user: SupabaseUser;
}

export const toSession = (r: TokenResponse): StoredSession => ({
  accessToken: r.access_token,
  refreshToken: r.refresh_token,
  expiresAt: r.expires_at ? r.expires_at * 1000 : Date.now() + (r.expires_in ?? 3600) * 1000,
  user: r.user,
});

/**
 * Holds the AUN session. Native: Keychain/Keystore. Web: browser storage
 * (needed to stay signed in; mitigated by short-lived access tokens and
 * refresh-token rotation — see docs/SECURITY.md).
 */
export class SupabaseClient {
  private session: StoredSession | null | undefined;
  private refreshing: Promise<StoredSession> | null = null;

  constructor(
    readonly config: SupabaseConfig,
    private readonly secure: SecureValueStore,
  ) {}

  async request<T>(path: string, init: RequestInit & { token?: string | null } = {}): Promise<T> {
    const { token, ...rest } = init;
    let res: Response;
    try {
      res = await fetch(`${this.config.url}${path}`, {
        ...rest,
        headers: {
          apikey: this.config.anonKey,
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(rest.headers ?? {}),
        },
      });
    } catch (e) {
      throw new NetworkError(e instanceof Error ? e.message : String(e));
    }
    const text = await res.text();
    const body = text ? (JSON.parse(text) as Record<string, unknown>) : undefined;
    if (!res.ok) {
      const code = String(body?.error_code ?? body?.error ?? body?.code ?? res.status);
      const message = String(body?.msg ?? body?.error_description ?? body?.message ?? res.statusText);
      throw new SupabaseHttpError(res.status, code, message);
    }
    return body as T;
  }

  async getSession(): Promise<StoredSession | null> {
    if (this.session === undefined) {
      const raw = await this.secure.getItem(SESSION_KEY);
      this.session = raw ? (JSON.parse(raw) as StoredSession) : null;
    }
    return this.session;
  }

  async setSession(session: StoredSession | null): Promise<void> {
    this.session = session;
    if (session) await this.secure.setItem(SESSION_KEY, JSON.stringify(session));
    else await this.secure.removeItem(SESSION_KEY);
  }

  /** A valid access token, refreshing (once, shared) when it is about to expire. */
  async accessToken(forceRefresh = false): Promise<string> {
    const s = await this.getSession();
    if (!s) throw new SupabaseHttpError(401, 'no_session', 'Not signed in');
    if (!forceRefresh && s.expiresAt > Date.now() + 60_000) return s.accessToken;
    if (!this.refreshing) {
      this.refreshing = this.request<TokenResponse>('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: s.refreshToken }),
      })
        .then(async (r) => {
          const next = toSession(r);
          await this.setSession(next);
          return next;
        })
        .catch(async (e) => {
          // Revoked/expired refresh token: the user must sign in again.
          if (e instanceof SupabaseHttpError && e.status >= 400 && e.status < 500) await this.setSession(null);
          throw e;
        })
        .finally(() => {
          this.refreshing = null;
        });
    }
    return (await this.refreshing).accessToken;
  }

  /** Authorised request with one retry on 401 after refreshing the token. */
  async authed<T>(path: string, init: RequestInit = {}): Promise<T> {
    try {
      return await this.request<T>(path, { ...init, token: await this.accessToken() });
    } catch (e) {
      if (e instanceof SupabaseHttpError && e.status === 401)
        return this.request<T>(path, { ...init, token: await this.accessToken(true) });
      throw e;
    }
  }
}
