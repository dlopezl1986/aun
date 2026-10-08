import { createId } from '@/utils/id';
import { StorageProviderError } from '../errors';
import type { LocalFileHandle, StorageConnection, StorageFileMetadata, StorageProvider, StoredFileRef, UploadSource } from '../types';
import { extensionOf } from './fileName';

/**
 * "Este dispositivo" on the web: binaries are stored as Blobs in IndexedDB
 * (per browser profile, survives reloads, works offline). Browsers may evict
 * this data under storage pressure; the app requests persistent storage.
 */
const DB_NAME = 'aun-files';
const STORE = 'files';

interface StoredBlob {
  key: string;
  blob: Blob;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new StorageProviderError('unavailable', 'local', 'IndexedDB not available'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = run(transaction.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        transaction.onerror = () => reject(transaction.error ?? request.error);
        transaction.onabort = () => reject(transaction.error ?? request.error);
      }),
  );
}

function mapError(e: unknown): StorageProviderError {
  if (e instanceof StorageProviderError) return e;
  const name = e instanceof DOMException ? e.name : '';
  if (name === 'QuotaExceededError') return new StorageProviderError('quota', 'local');
  return new StorageProviderError('unknown', 'local', e instanceof Error ? e.message : String(e));
}

export class LocalStorageProvider implements StorageProvider {
  readonly id = 'local';

  constructor(private readonly userId: string) {}

  private toMeta(row: StoredBlob, parentId: string | null): StorageFileMetadata {
    return {
      providerId: this.id,
      providerFileId: row.key,
      name: row.name,
      mimeType: row.mimeType,
      size: row.size,
      modifiedAt: row.createdAt,
      parentId,
    };
  }

  private async row(ref: StoredFileRef): Promise<StoredBlob> {
    const row = await tx<StoredBlob | undefined>('readonly', (s) => s.get(ref.providerFileId));
    if (!row) throw new StorageProviderError('not-found', this.id);
    return row;
  }

  async initialize(): Promise<void> {
    await openDb();
    // Ask the browser not to evict our data under storage pressure (best effort).
    try {
      await navigator.storage?.persist?.();
    } catch {
      // ignore: not supported
    }
  }

  async authenticate(): Promise<StorageConnection> {
    return { connected: true };
  }

  async getConnection(): Promise<StorageConnection> {
    return { connected: true };
  }

  async uploadFile(source: UploadSource, parentId: string | null): Promise<StorageFileMetadata> {
    try {
      const blob = source.file ?? (await (await fetch(source.uri)).blob());
      const ext = extensionOf(source.name);
      const row: StoredBlob = {
        key: `${this.userId}/${createId()}${ext ? `.${ext}` : ''}`,
        blob,
        name: source.name,
        mimeType: source.mimeType || blob.type || 'application/octet-stream',
        size: blob.size,
        createdAt: new Date().toISOString(),
      };
      await tx('readwrite', (s) => s.put(row));
      return this.toMeta(row, parentId);
    } catch (e) {
      throw mapError(e);
    }
  }

  async downloadFile(ref: StoredFileRef): Promise<LocalFileHandle> {
    const row = await this.row(ref);
    const uri = URL.createObjectURL(row.blob);
    return { uri, release: () => URL.revokeObjectURL(uri) };
  }

  async deleteFile(ref: StoredFileRef): Promise<void> {
    await tx('readwrite', (s) => s.delete(ref.providerFileId));
  }

  async moveFile(ref: StoredFileRef, newParentId: string | null): Promise<StorageFileMetadata> {
    return this.toMeta(await this.row(ref), newParentId);
  }

  async renameFile(ref: StoredFileRef, newName: string): Promise<StorageFileMetadata> {
    const row = await this.row(ref);
    return this.toMeta({ ...row, name: newName }, null);
  }

  async listFiles(): Promise<StorageFileMetadata[]> {
    const rows = await tx<StoredBlob[]>('readonly', (s) => s.getAll());
    return rows.filter((r) => r.key.startsWith(`${this.userId}/`)).map((r) => this.toMeta(r, null));
  }

  async createFolder(): Promise<StoredFileRef> {
    return { providerId: this.id, providerFileId: createId() };
  }

  async deleteFolder(): Promise<void> {}

  async moveFolder(): Promise<void> {}

  async searchFiles(): Promise<StorageFileMetadata[]> {
    return [];
  }

  async getFileMetadata(ref: StoredFileRef): Promise<StorageFileMetadata> {
    return this.toMeta(await this.row(ref), null);
  }

  async disconnect(): Promise<void> {
    // Never deletes files.
  }
}

export function createLocalStorageProvider(userId: string): StorageProvider {
  return new LocalStorageProvider(userId);
}
