import { Directory, File, Paths, UploadType } from 'expo-file-system';

import { StorageProviderError } from '../errors';
import { extensionOf } from '../local/fileName';
import type { LocalFileHandle, UploadSource } from '../types';
import { DRIVE_API, DRIVE_UPLOAD, FILE_FIELDS, driveError, type DriveFile } from './driveClient';

/**
 * Native transfers stream straight from/to disk (no base64, no big strings in JS):
 *  - upload: Drive resumable session + File.upload (PUT).
 *  - download: File.downloadFileAsync into the cache directory.
 */
export async function uploadToDrive(token: string, source: UploadSource, parentId: string): Promise<DriveFile> {
  let session: Response;
  try {
    session = await fetch(`${DRIVE_UPLOAD}/files?uploadType=resumable&fields=${FILE_FIELDS}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': source.mimeType,
      },
      body: JSON.stringify({ name: source.name, parents: [parentId], mimeType: source.mimeType }),
    });
  } catch (e) {
    throw new StorageProviderError('network', 'google-drive', String(e));
  }
  if (!session.ok) throw await driveError(session);
  const location = session.headers.get('Location') ?? session.headers.get('location');
  if (!location) throw new StorageProviderError('unknown', 'google-drive', 'No upload session');

  const result = await new File(source.uri).upload(location, {
    httpMethod: 'PUT',
    uploadType: UploadType.BINARY_CONTENT,
    headers: { 'Content-Type': source.mimeType },
  });
  if (result.status === 403 && /quota/i.test(result.body)) throw new StorageProviderError('quota', 'google-drive');
  if (result.status < 200 || result.status >= 300) {
    throw new StorageProviderError(result.status === 401 ? 'auth-expired' : 'unknown', 'google-drive', `${result.status}`);
  }
  return JSON.parse(result.body) as DriveFile;
}

const cacheDir = () => new Directory(Paths.cache, 'aun-drive');

export async function downloadFromDrive(token: string, file: DriveFile): Promise<LocalFileHandle> {
  const dir = cacheDir();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const ext = extensionOf(file.name);
  const target = new File(dir, ext ? `${file.id}.${ext}` : file.id);
  // Re-download if the cached copy is older than the Drive version.
  const fresh = target.exists && file.modifiedTime && (target.modificationTime ?? 0) >= Date.parse(file.modifiedTime);
  if (!fresh) {
    if (target.exists) target.delete();
    try {
      await File.downloadFileAsync(`${DRIVE_API}/files/${file.id}?alt=media`, target, { headers: { Authorization: `Bearer ${token}` } });
    } catch (e) {
      throw new StorageProviderError('network', 'google-drive', String(e));
    }
  }
  return { uri: target.uri };
}

export function forgetCachedCopy(fileId: string): void {
  const dir = cacheDir();
  if (!dir.exists) return;
  for (const entry of dir.list()) if (entry instanceof File && entry.name.startsWith(fileId)) entry.delete();
}
