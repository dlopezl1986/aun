import {
  AuthRequest,
  exchangeCodeAsync,
  makeRedirectUri,
  refreshAsync,
  ResponseType,
  revokeAsync,
  type DiscoveryDocument,
} from 'expo-auth-session';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import type { OAuthTokens } from './tokenStore';

/**
 * Generic OAuth 2.0 public-client flow (no client secret ever ships in the app).
 *  - Native: Authorization Code + PKCE, refresh token kept by the caller in the
 *    Keychain/Keystore (tokenStore).
 *  - Web: either implicit (Google: access token only) or Code + PKCE where the
 *    provider allows SPAs (Microsoft). Tokens stay in memory only.
 * Never asks for, sees or stores the user's password.
 */
export interface OAuthProviderConfig {
  name: string;
  discovery: DiscoveryDocument;
  clientId: () => string;
  scopes: string[];
  /** Web flow: Google only allows implicit tokens for browser clients. */
  webFlow: 'implicit' | 'pkce';
  /** Native redirect URI (custom scheme registered with the provider). */
  nativeRedirect: (clientId: string) => string;
  /** Platforms the provider does not allow with custom-scheme redirects. */
  unsupportedPlatforms?: (typeof Platform.OS)[];
  extraParams?: { web?: Record<string, string>; native?: Record<string, string> };
  prompt?: string;
}

export type OAuthSupport = { supported: true } | { supported: false; reason: 'notConfigured' | 'platform' | 'expoGo' };

export class OAuthError extends Error {
  constructor(
    readonly code: 'not-configured' | 'unavailable' | 'denied' | 'expired' | 'failed',
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'OAuthError';
  }
}

export function oauthSupport(config: OAuthProviderConfig): OAuthSupport {
  if (config.unsupportedPlatforms?.includes(Platform.OS)) return { supported: false, reason: 'platform' };
  if (Platform.OS !== 'web' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient)
    return { supported: false, reason: 'expoGo' };
  if (!config.clientId()) return { supported: false, reason: 'notConfigured' };
  return { supported: true };
}

const expiry = (issuedAt: number, expiresIn?: number) => (issuedAt + (expiresIn ?? 3600)) * 1000;

/** Opens the provider's consent screen. Returns null if the user cancels. */
export async function authorize(config: OAuthProviderConfig): Promise<OAuthTokens | null> {
  const support = oauthSupport(config);
  if (!support.supported) throw new OAuthError(support.reason === 'notConfigured' ? 'not-configured' : 'unavailable');
  const clientId = config.clientId();
  const isWeb = Platform.OS === 'web';
  const implicit = isWeb && config.webFlow === 'implicit';
  const redirectUri = isWeb ? makeRedirectUri() : makeRedirectUri({ native: config.nativeRedirect(clientId) });
  const request = new AuthRequest({
    clientId,
    redirectUri,
    scopes: config.scopes,
    responseType: implicit ? ResponseType.Token : ResponseType.Code,
    usePKCE: !implicit,
    prompt: config.prompt as AuthRequest['prompt'],
    extraParams: (isWeb ? config.extraParams?.web : config.extraParams?.native) ?? {},
  });
  const result = await request.promptAsync(config.discovery);
  if (result.type === 'cancel' || result.type === 'dismiss') return null;
  if (result.type !== 'success') {
    const message = result.type === 'error' ? (result.error?.message ?? result.params.error) : result.type;
    throw new OAuthError(result.type === 'error' && result.params.error === 'access_denied' ? 'denied' : 'failed', message);
  }
  if (implicit) {
    const accessToken = result.params.access_token;
    if (!accessToken) throw new OAuthError('failed', 'No access token');
    return { accessToken, expiresAt: Date.now() + Number(result.params.expires_in ?? 3600) * 1000 };
  }
  const token = await exchangeCodeAsync(
    { clientId, code: result.params.code, redirectUri, extraParams: { code_verifier: request.codeVerifier ?? '' } },
    config.discovery,
  );
  return { accessToken: token.accessToken, refreshToken: token.refreshToken, expiresAt: expiry(token.issuedAt, token.expiresIn) };
}

/** New tokens from a refresh token; throws `expired` when the user must reconnect. */
export async function refreshTokens(config: OAuthProviderConfig, tokens: OAuthTokens): Promise<OAuthTokens> {
  if (!tokens.refreshToken) throw new OAuthError('expired');
  try {
    const r = await refreshAsync(
      { clientId: config.clientId(), refreshToken: tokens.refreshToken, scopes: config.scopes },
      config.discovery,
    );
    return {
      ...tokens,
      accessToken: r.accessToken,
      refreshToken: r.refreshToken ?? tokens.refreshToken,
      expiresAt: expiry(r.issuedAt, r.expiresIn),
    };
  } catch {
    throw new OAuthError('expired');
  }
}

/** Best-effort revocation (providers without a revocation endpoint just forget the tokens). */
export async function revokeTokens(config: OAuthProviderConfig, tokens: OAuthTokens): Promise<void> {
  if (!config.discovery.revocationEndpoint) return;
  try {
    await revokeAsync({ token: tokens.refreshToken ?? tokens.accessToken, clientId: config.clientId() }, config.discovery);
  } catch {
    // Token may already be invalid.
  }
}
