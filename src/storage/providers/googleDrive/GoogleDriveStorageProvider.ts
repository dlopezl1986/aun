import { connectGoogleDrive, disconnectGoogleDrive, getGoogleAccessToken, getGoogleConnection } from '@/services/oauth/googleOAuth';
import { StorageProviderError } from '../errors';
import type { LocalFileHandle, StorageConnection, StorageFileMetadata, StorageProvider, StoredFileRef, UploadSource } from '../types';
import { DRIVE_API, FILE_FIELDS, FOLDER_MIME, driveFetch, q, type DriveFile } from './driveClient';
import { downloadFromDrive, forgetCachedCopy, uploadToDrive } from './transfer';

const ROOT_NAME = 'AUN';

/**
 * Google Drive provider (section 23). Files are stored in an "AUN" folder at
 * the root of the user's Drive. With the `drive.file` scope AUN can only see
 * files it created itself — never the rest of the user's Drive.
 */
export class GoogleDriveStorageProvider implements StorageProvider {
  readonly id = 'google-drive';
  private rootId: string | null = null;

  constructor(private readonly userId: string) {}

  private token = (forceRefresh = false) => getGoogleAccessToken(this.userId, forceRefresh);

  private toMeta(f: DriveFile): StorageFileMetadata {
    return {
      providerId: this.id,
      providerFileId: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: Number(f.size ?? 0),
      modifiedAt: f.modifiedTime ?? new Date().toISOString(),
      parentId: f.parents?.[0] ?? null,
    };
  }

  /** Finds (or creates) the app's root folder. */
  private async root(): Promise<string> {
    if (this.rootId) return this.rootId;
    const query = encodeURIComponent(`name='${q(ROOT_NAME)}' and mimeType='${FOLDER_MIME}' and 'root' in parents and trashed=false`);
    const found = await driveFetch<{ files: DriveFile[] }>(
      this.token,
      `${DRIVE_API}/files?q=${query}&fields=files(${FILE_FIELDS})&spaces=drive`,
    );
    if (found.files[0]) {
      this.rootId = found.files[0].id;
      return this.rootId;
    }
    const created = await driveFetch<DriveFile>(this.token, `${DRIVE_API}/files?fields=${FILE_FIELDS}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: ROOT_NAME, mimeType: FOLDER_MIME, parents: ['root'] }),
    });
    this.rootId = created.id;
    return created.id;
  }

  private file(ref: StoredFileRef): Promise<DriveFile> {
    return driveFetch<DriveFile>(this.token, `${DRIVE_API}/files/${ref.providerFileId}?fields=${FILE_FIELDS}`);
  }

  async initialize(): Promise<void> {
    const connection = await this.getConnection();
    if (!connection.connected) throw new StorageProviderError('not-connected', this.id);
    await this.root();
  }

  async authenticate(): Promise<StorageConnection> {
    const tokens = await connectGoogleDrive(this.userId);
    if (!tokens) return { connected: false };
    this.rootId = null;
    await this.root();
    return { connected: true, accountLabel: tokens.accountEmail };
  }

  async getConnection(): Promise<StorageConnection> {
    const c = await getGoogleConnection(this.userId);
    return { connected: c.connected, accountLabel: c.email };
  }

  async uploadFile(source: UploadSource, parentId: string | null): Promise<StorageFileMetadata> {
    const parent = parentId ?? (await this.root());
    let token = await this.token();
    try {
      return this.toMeta(await uploadToDrive(token, source, parent));
    } catch (e) {
      if (!(e instanceof StorageProviderError) || e.code !== 'auth-expired') throw e;
      token = await this.token(true);
      return this.toMeta(await uploadToDrive(token, source, parent));
    }
  }

  async downloadFile(ref: StoredFileRef): Promise<LocalFileHandle> {
    const file = await this.file(ref);
    return downloadFromDrive(await this.token(), file);
  }

  async deleteFile(ref: StoredFileRef): Promise<void> {
    // Moves to the Drive trash (recoverable for 30 days) rather than a hard delete.
    await driveFetch(this.token, `${DRIVE_API}/files/${ref.providerFileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashed: true }),
    });
    forgetCachedCopy(ref.providerFileId);
  }

  async moveFile(ref: StoredFileRef, newParentId: string | null): Promise<StorageFileMetadata> {
    // Folders are AUN metadata: the binary stays in the AUN root (see types.ts).
    if (!newParentId) return this.toMeta(await this.file(ref));
    const current = await this.file(ref);
    const moved = await driveFetch<DriveFile>(
      this.token,
      `${DRIVE_API}/files/${ref.providerFileId}?addParents=${newParentId}&removeParents=${(current.parents ?? []).join(',')}&fields=${FILE_FIELDS}`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' },
    );
    return this.toMeta(moved);
  }

  async renameFile(ref: StoredFileRef, newName: string): Promise<StorageFileMetadata> {
    const renamed = await driveFetch<DriveFile>(this.token, `${DRIVE_API}/files/${ref.providerFileId}?fields=${FILE_FIELDS}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });
    return this.toMeta(renamed);
  }

  async listFiles(parentId: string | null): Promise<StorageFileMetadata[]> {
    const parent = parentId ?? (await this.root());
    const query = encodeURIComponent(`'${q(parent)}' in parents and trashed=false`);
    const res = await driveFetch<{ files: DriveFile[] }>(
      this.token,
      `${DRIVE_API}/files?q=${query}&fields=files(${FILE_FIELDS})&pageSize=1000`,
    );
    return res.files.map((f) => this.toMeta(f));
  }

  async createFolder(name: string, parentId: string | null): Promise<StoredFileRef> {
    const folder = await driveFetch<DriveFile>(this.token, `${DRIVE_API}/files?fields=${FILE_FIELDS}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId ?? (await this.root())] }),
    });
    return { providerId: this.id, providerFileId: folder.id };
  }

  async deleteFolder(ref: StoredFileRef): Promise<void> {
    await this.deleteFile(ref);
  }

  async moveFolder(ref: StoredFileRef, newParentId: string | null): Promise<void> {
    await this.moveFile(ref, newParentId ?? (await this.root()));
  }

  async searchFiles(query: string): Promise<StorageFileMetadata[]> {
    const qs = encodeURIComponent(`name contains '${q(query)}' and trashed=false`);
    const res = await driveFetch<{ files: DriveFile[] }>(this.token, `${DRIVE_API}/files?q=${qs}&fields=files(${FILE_FIELDS})&pageSize=50`);
    return res.files.map((f) => this.toMeta(f));
  }

  async getFileMetadata(ref: StoredFileRef): Promise<StorageFileMetadata> {
    return this.toMeta(await this.file(ref));
  }

  /** Revokes access and forgets tokens. Files stay in the user's Drive. */
  async disconnect(): Promise<void> {
    this.rootId = null;
    await disconnectGoogleDrive(this.userId);
  }
}

export function createGoogleDriveProvider(userId: string): StorageProvider {
  return new GoogleDriveStorageProvider(userId);
}
