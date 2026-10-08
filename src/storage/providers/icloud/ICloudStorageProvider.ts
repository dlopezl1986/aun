import { StorageProviderError } from '../errors';
import type { StorageProvider, StorageProviderId } from '../types';

/**
 * iCloud Drive — PREPARED, NOT IMPLEMENTED (section 24).
 *
 * Why it can't work yet:
 *  - iCloud Drive is only reachable through Apple's native APIs
 *    (NSFileManager ubiquity container / NSFileCoordinator) on iOS.
 *  - It requires the iCloud capability + a container identifier on the
 *    Apple Developer account and a development/production build: it can't run
 *    in Expo Go, on Android or on the web.
 *
 * Plan: a small Expo native module (config plugin adding the iCloud
 * entitlements) exposing copy/delete/list inside the ubiquity container,
 * wrapped by this class. Until then every call fails explicitly — the UI
 * never offers iCloud as active (see descriptors.ts), nothing is faked.
 */
const notAvailable = (): never => {
  throw new StorageProviderError('unavailable', 'icloud', 'iCloud Drive requires the native iOS module (not built yet)');
};

export class ICloudStorageProvider implements StorageProvider {
  readonly id: StorageProviderId = 'icloud';
  initialize = async () => notAvailable();
  authenticate = async () => notAvailable();
  getConnection = async () => ({ connected: false });
  uploadFile = async () => notAvailable();
  downloadFile = async () => notAvailable();
  deleteFile = async () => notAvailable();
  moveFile = async () => notAvailable();
  renameFile = async () => notAvailable();
  listFiles = async () => notAvailable();
  createFolder = async () => notAvailable();
  deleteFolder = async () => notAvailable();
  moveFolder = async () => notAvailable();
  searchFiles = async () => notAvailable();
  getFileMetadata = async () => notAvailable();
  disconnect = async () => undefined;
}
