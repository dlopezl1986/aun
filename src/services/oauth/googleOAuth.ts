import {
  AuthRequest,
  exchangeCodeAsync,
  makeRedirectUri,
  Prompt,
  refreshAsync,
  ResponseType,
  revokeAsync,
  type DiscoveryDocument,
} from 'expo-auth-session';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { appConfig } from '@/config/featureFlags';
import { StorageProviderError } from '@/storage/providers/errors';
import { tokenStore, type OAuthTokens } from './tokenStore';

/**
 * Google OAuth 2.0 for Drive (section 23).
 *  - Least privilege: `drive.file` → AUN only sees files it created/opened.
 *  - Never asks for or stores the Google password.
 *  - Web: implicit token in a popup (access token only, memory only).
 *  - iOS: Authorization Code + PKCE with the iOS client (no secret), refresh
 *    token stored in the Keychain. Requires a development/production build
 *    (Google rejects Expo Go's exp:// redirect).
 *  - Android: Google no longer allows custom-scheme redirects; needs the
 *    native Google sign-in module (future dev build) → reported as unavailable.
 */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const SCOPES = [DRIVE_SCOPE, 'openid', 'email'];

const discovery: DiscoveryDocument = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

export type GoogleSupport = { supported: true } | { supported: false; reason: 'notConfigured' | 'android' | 'expoGo' };

function clientId(): string {
  if (Platform.OS === 'web') return appConfig.googleWebClientId;
  if (Platform.OS === 'ios') return appConfig.googleIosClientId;
  return appConfig.googleAndroidClientId;
}

/** "123-abc.apps.googleusercontent.com" → "com.googleusercontent.apps.123-abc" */
export function reversedClientId(id: string): string {
  return id.split('.').reverse().join('.');
}

export function googleDriveSupport(): GoogleSupport {
  if (Platform.OS === 'android') return { supported: false, reason: 'android' };
  if (Platform.OS === 'ios' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return { supported: false, reason: 'expoGo' };
  }
  if (!clientId()) return { supported: false, reason: 'notConfigured' };
  return { supported: true };
}

const tokenKey = (userId: string) => `aun.oauth.google.${userId}`;

async function fetchEmail(accessToken: string): Promise<string | undefined> {
  try {
    const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) return undefined;
    return ((await res.json()) as { email?: string }).email;
  } catch {
    return undefined;
  }
}

/** Opens Google's consent screen. Returns null if the user cancels. */
export async function connectGoogleDrive(userId: string): Promise<OAuthTokens | null> {
  const support = googleDriveSupport();
  if (!support.supported)
    throw new StorageProviderError(support.reason === 'notConfigured' ? 'not-configured' : 'unavailable', 'google-drive');
  const id = clientId();
  const isWeb = Platform.OS === 'web';
  const redirectUri = isWeb ? makeRedirectUri() : makeRedirectUri({ native: `${reversedClientId(id)}:/oauthredirect` });
  const request = new AuthRequest({
    clientId: id,
    redirectUri,
    scopes: SCOPES,
    responseType: isWeb ? ResponseType.Token : ResponseType.Code,
    usePKCE: !isWeb,
    prompt: Prompt.SelectAccount,
    extraParams: isWeb ? {} : { access_type: 'offline' },
  });
  const result = await request.promptAsync(discovery);
  if (result.type === 'cancel' || result.type === 'dismiss') return null;
  if (result.type !== 'success')
    throw new StorageProviderError('auth-expired', 'google-drive', result.type === 'error' ? result.error?.message : result.type);

  let tokens: OAuthTokens;
  if (isWeb) {
    const accessToken = result.params.access_token;
    if (!accessToken) throw new StorageProviderError('unknown', 'google-drive', 'No access token');
    tokens = { accessToken, expiresAt: Date.now() + Number(result.params.expires_in ?? 3600) * 1000 };
  } else {
    const token = await exchangeCodeAsync(
      { clientId: id, code: result.params.code, redirectUri, extraParams: { code_verifier: request.codeVerifier ?? '' } },
      discovery,
    );
    tokens = {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: (token.issuedAt + (token.expiresIn ?? 3600)) * 1000,
    };
  }
  tokens.accountEmail = await fetchEmail(tokens.accessToken);
  await tokenStore.set(tokenKey(userId), tokens);
  return tokens;
}

export async function getGoogleConnection(userId: string): Promise<{ connected: boolean; email?: string }> {
  const tokens = await tokenStore.get(tokenKey(userId));
  if (!tokens) return { connected: false };
  const usable = tokens.expiresAt > Date.now() + 30_000 || !!tokens.refreshToken;
  return { connected: usable, email: tokens.accountEmail };
}

/** A valid access token, refreshing it on native when needed. */
export async function getGoogleAccessToken(userId: string, forceRefresh = false): Promise<string> {
  const tokens = await tokenStore.get(tokenKey(userId));
  if (!tokens) throw new StorageProviderError('not-connected', 'google-drive');
  if (!forceRefresh && tokens.expiresAt > Date.now() + 60_000) return tokens.accessToken;
  if (!tokens.refreshToken) throw new StorageProviderError('auth-expired', 'google-drive');
  try {
    const refreshed = await refreshAsync({ clientId: clientId(), refreshToken: tokens.refreshToken }, discovery);
    const next: OAuthTokens = {
      ...tokens,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? tokens.refreshToken,
      expiresAt: (refreshed.issuedAt + (refreshed.expiresIn ?? 3600)) * 1000,
    };
    await tokenStore.set(tokenKey(userId), next);
    return next.accessToken;
  } catch {
    // Revoked or expired refresh token: the user must reconnect.
    throw new StorageProviderError('auth-expired', 'google-drive');
  }
}

/** Revokes AUN's access (best effort) and forgets the tokens. Never deletes Drive files. */
export async function disconnectGoogleDrive(userId: string): Promise<void> {
  const tokens = await tokenStore.get(tokenKey(userId));
  if (tokens) {
    try {
      await revokeAsync({ token: tokens.refreshToken ?? tokens.accessToken, clientId: clientId() }, discovery);
    } catch {
      // ignore: token may already be invalid
    }
  }
  await tokenStore.remove(tokenKey(userId));
}
