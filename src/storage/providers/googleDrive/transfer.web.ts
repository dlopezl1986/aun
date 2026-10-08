import { StorageProviderError } from '../errors';
import type { LocalFileHandle, UploadSource } from '../types';
import { DRIVE_API, DRIVE_UPLOAD, FILE_FIELDS, driveError, type DriveFile } from './driveClient';

/** Web transfers: multipart/related upload of the picked Blob; download to a blob URL. */
export async function uploadToDrive(token: string, source: UploadSource, parentId: string): Promise<DriveFile> {
  const blob = source.file ?? (await (await fetch(source.uri)).blob());
  const boundary = `aun-${Math.random().toString(36).slice(2)}`;
  const metadata = JSON.stringify({ name: source.name, parents: [parentId], mimeType: source.mimeType });
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
    `--${boundary}\r\nContent-Type: ${source.mimeType || 'application/octet-stream'}\r\n\r\n`,
    blob,
    `\r\n--${boundary}--`,
  ]);
  let res: Response;
  try {
    res = await fetch(`${DRIVE_UPLOAD}/files?uploadType=multipart&fields=${FILE_FIELDS}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
  } catch (e) {
    throw new StorageProviderError('network', 'google-drive', String(e));
  }
  if (!res.ok) throw await driveError(res);
  return (await res.json()) as DriveFile;
}

export async function downloadFromDrive(token: string, file: DriveFile): Promise<LocalFileHandle> {
  let res: Response;
  try {
    res = await fetch(`${DRIVE_API}/files/${file.id}?alt=media`, { headers: { Authorization: `Bearer ${token}` } });
  } catch (e) {
    throw new StorageProviderError('network', 'google-drive', String(e));
  }
  if (!res.ok) throw await driveError(res);
  const uri = URL.createObjectURL(await res.blob());
  return { uri, release: () => URL.revokeObjectURL(uri) };
}

export function forgetCachedCopy(): void {
  // Nothing cached on the web (blob URLs are released by the viewer).
}
