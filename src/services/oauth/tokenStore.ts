import { Platform } from 'react-native';

import { secureStore } from '@/storage/secureStore';

export interface OAuthTokens {
  accessToken: string;
  /** Native only. Never available/stored on the web. */
  refreshToken?: string;
  /** Epoch ms. */
  expiresAt: number;
  accountEmail?: string;
}

/**
 * Where OAuth tokens live:
 *  - iOS/Android: Keychain / Keystore (expo-secure-store).
 *  - Web: process memory ONLY (lost on reload by design). Browser storage is
 *    readable by any script on the origin, so third-party tokens never touch it.
 */
const memory = new Map<string, OAuthTokens>();
const persistent = Platform.OS !== 'web';

export const tokenStore = {
  async get(key: string): Promise<OAuthTokens | null> {
    if (!persistent) return memory.get(key) ?? null;
    const raw = await secureStore.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as OAuthTokens;
    } catch {
      return null;
    }
  },
  async set(key: string, tokens: OAuthTokens): Promise<void> {
    if (!persistent) {
      memory.set(key, tokens);
      return;
    }
    await secureStore.setItem(key, JSON.stringify(tokens));
  },
  async remove(key: string): Promise<void> {
    memory.delete(key);
    if (persistent) await secureStore.removeItem(key);
  },
  /** False on web: the connection lasts for the browser session. */
  persistent,
};
