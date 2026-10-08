import { StorageProviderError } from './errors';
import { createGoogleDriveProvider } from './googleDrive/GoogleDriveStorageProvider';
import { ICloudStorageProvider } from './icloud/ICloudStorageProvider';
import { createLocalStorageProvider } from './local/LocalStorageProvider';
import type { StorageProvider, StorageProviderId } from './types';

type ProviderFactory = (userId: string) => StorageProvider;

/**
 * Registry of provider implementations. Adding OneDrive/Dropbox/AUN Cloud =
 * implement StorageProvider + register it here (+ a descriptor).
 */
const factories: Record<string, ProviderFactory> = {
  local: createLocalStorageProvider,
  'google-drive': createGoogleDriveProvider,
  icloud: () => new ICloudStorageProvider(),
};

export function registerStorageProvider(id: StorageProviderId, factory: ProviderFactory): void {
  factories[id] = factory;
}

const cache = new Map<string, StorageProvider>();

/** Provider instance for a user. Documents always use the provider they were stored with. */
export function getStorageProvider(id: StorageProviderId, userId: string): StorageProvider {
  const key = `${userId}:${id}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const factory = factories[id];
  if (!factory) throw new StorageProviderError('unavailable', id);
  const provider = factory(userId);
  cache.set(key, provider);
  return provider;
}
