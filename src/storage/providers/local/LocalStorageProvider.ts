import { Directory, File, Paths } from 'expo-file-system';

import { createId } from '@/utils/id';
import { StorageProviderError } from '../errors';
import type { LocalFileHandle, StorageConnection, StorageFileMetadata, StorageProvider, StoredFileRef, UploadSource } from '../types';
import { extensionOf } from './fileName';

/**
 * "Este dispositivo" on iOS/Android: binaries live in the app's Documents
 * directory (not purged by the OS, included in device backups), one folder
 * per user. Works fully offline. Folder structure is AUN metadata.
 */
export class LocalStorageProvider implements StorageProvider {
  readonly id = 'local';
  private readonly dir: Directory;

  constructor(userId: string) {
    this.dir = new Directory(Paths.document, 'aun', userId, 'files');
  }

  private fileFor(ref: StoredFileRef): File {
    return new File(this.dir, ref.providerFileId);
  }

  private meta(file: File, name: string, mimeType: string, parentId: string | null): StorageFileMetadata {
    return {
      providerId: this.id,
      providerFileId: file.name,
      name,
      mimeType,
      size: file.size ?? 0,
      modifiedAt: new Date().toISOString(),
      parentId,
    };
  }

  async initialize(): Promise<void> {
    if (!this.dir.exists) this.dir.create({ intermediates: true, idempotent: true });
  }

  async authenticate(): Promise<StorageConnection> {
    return { connected: true };
  }

  async getConnection(): Promise<StorageConnection> {
    return { connected: true };
  }

  async uploadFile(source: UploadSource, parentId: string | null): Promise<StorageFileMetadata> {
    await this.initialize();
    const ext = extensionOf(source.name);
    const destination = new File(this.dir, ext ? `${createId()}.${ext}` : createId());
    try {
      await new File(source.uri).copy(destination);
    } catch (e) {
      throw new StorageProviderError('unknown', this.id, e instanceof Error ? e.message : String(e));
    }
    return this.meta(destination, source.name, source.mimeType, parentId);
  }

  async downloadFile(ref: StoredFileRef): Promise<LocalFileHandle> {
    const file = this.fileFor(ref);
    if (!file.exists) throw new StorageProviderError('not-found', this.id);
    return { uri: file.uri };
  }

  async deleteFile(ref: StoredFileRef): Promise<void> {
    const file = this.fileFor(ref);
    if (file.exists) file.delete();
  }

  // Names and folders are AUN metadata: the binary does not need to change.
  async moveFile(ref: StoredFileRef, newParentId: string | null): Promise<StorageFileMetadata> {
    const file = this.fileFor(ref);
    return this.meta(file, file.name, file.type ?? 'application/octet-stream', newParentId);
  }

  async renameFile(ref: StoredFileRef, newName: string): Promise<StorageFileMetadata> {
    const file = this.fileFor(ref);
    return this.meta(file, newName, file.type ?? 'application/octet-stream', null);
  }

  async listFiles(): Promise<StorageFileMetadata[]> {
    await this.initialize();
    return this.dir
      .list()
      .filter((e): e is File => e instanceof File)
      .map((f) => this.meta(f, f.name, f.type ?? 'application/octet-stream', null));
  }

  async createFolder(): Promise<StoredFileRef> {
    return { providerId: this.id, providerFileId: createId() };
  }

  async deleteFolder(): Promise<void> {}

  async moveFolder(): Promise<void> {}

  async searchFiles(): Promise<StorageFileMetadata[]> {
    // Search runs over AUN metadata (names, later tags/OCR), not the disk.
    return [];
  }

  async getFileMetadata(ref: StoredFileRef): Promise<StorageFileMetadata> {
    const file = this.fileFor(ref);
    if (!file.exists) throw new StorageProviderError('not-found', this.id);
    return this.meta(file, file.name, file.type ?? 'application/octet-stream', null);
  }

  async disconnect(): Promise<void> {
    // Never deletes files: switching provider keeps local documents intact.
  }
}

export function createLocalStorageProvider(userId: string): StorageProvider {
  return new LocalStorageProvider(userId);
}
