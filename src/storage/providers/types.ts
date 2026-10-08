/**
 * 2ndBrain storage abstraction (sections 18–24, 43).
 *
 * 2ndBrain logic talks ONLY to `StorageProvider`. Concrete providers
 * (Local, Google Drive, iCloud, later OneDrive/Dropbox/AUN Cloud) live in
 * their own files and are created through `getStorageProvider` (factory.ts).
 *
 * Folder structure is AUN metadata (unlimited depth, instant moves/renames,
 * searchable). Providers store binaries flat inside an "AUN" root; the
 * folder methods stay in the contract for a future "mirror folders" option.
 */
export type StorageProviderId = 'local' | 'google-drive' | 'icloud' | (string & {});

export interface StoredFileRef {
  /** Provider-specific identifier (file path, Drive fileId, iCloud URL…). */
  providerFileId: string;
  providerId: StorageProviderId;
}

export interface StorageFileMetadata extends StoredFileRef {
  name: string;
  mimeType: string;
  size: number;
  modifiedAt: string;
  parentId: string | null;
}

export interface UploadSource {
  /** Local URI (file://, content://, blob:, data:) produced by a picker. */
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
  /** Web only: the picked File/Blob (avoids re-reading a data: URI). */
  file?: Blob;
}

/** Result of `downloadFile`: a URI viewers/sharing can use locally. */
export interface LocalFileHandle {
  uri: string;
  /** Web: releases the temporary blob URL. */
  release?: () => void;
}

export interface StorageConnection {
  connected: boolean;
  /** Account label to show, e.g. "david@gmail.com" or "Este dispositivo". */
  accountLabel?: string;
}

export interface StorageProvider {
  readonly id: StorageProviderId;
  initialize(): Promise<void>;
  /** Starts the provider's auth flow (OAuth for Drive). No-op for Local. */
  authenticate(): Promise<StorageConnection>;
  getConnection(): Promise<StorageConnection>;
  uploadFile(source: UploadSource, parentId: string | null): Promise<StorageFileMetadata>;
  /** Returns a URI the viewer can open locally. */
  downloadFile(ref: StoredFileRef): Promise<LocalFileHandle>;
  deleteFile(ref: StoredFileRef): Promise<void>;
  moveFile(ref: StoredFileRef, newParentId: string | null): Promise<StorageFileMetadata>;
  renameFile(ref: StoredFileRef, newName: string): Promise<StorageFileMetadata>;
  listFiles(parentId: string | null): Promise<StorageFileMetadata[]>;
  createFolder(name: string, parentId: string | null): Promise<StoredFileRef>;
  deleteFolder(ref: StoredFileRef): Promise<void>;
  moveFolder(ref: StoredFileRef, newParentId: string | null): Promise<void>;
  searchFiles(query: string): Promise<StorageFileMetadata[]>;
  getFileMetadata(ref: StoredFileRef): Promise<StorageFileMetadata>;
  /** Disconnects the account. MUST NOT delete any user file. */
  disconnect(): Promise<void>;
}

/** Future: copy documents between providers ("Migrar documentos"). */
export interface StorageMigrationPlan {
  from: StorageProviderId;
  to: StorageProviderId;
  documentIds: string[];
}
