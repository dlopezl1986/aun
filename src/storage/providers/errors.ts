import type { StorageProviderId } from './types';

export type StorageErrorCode =
  | 'unavailable' // provider not usable on this platform/build
  | 'not-configured' // missing OAuth client configuration
  | 'not-connected' // user has not connected the account
  | 'auth-expired' // token expired/revoked → reconnect
  | 'not-found'
  | 'quota' // storage full
  | 'too-large'
  | 'network'
  | 'unknown';

export class StorageProviderError extends Error {
  constructor(
    public readonly code: StorageErrorCode,
    public readonly providerId: StorageProviderId,
    message?: string,
  ) {
    super(message ?? `${providerId}: ${code}`);
    this.name = 'StorageProviderError';
  }
}
