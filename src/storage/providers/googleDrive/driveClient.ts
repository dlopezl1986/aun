import { StorageProviderError } from '../errors';

/** Minimal typed client for Google Drive REST v3 (only what 2ndBrain needs). */
export const DRIVE_API = 'https://www.googleapis.com/drive/v3';
export const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
export const FOLDER_MIME = 'application/vnd.google-apps.folder';
export const FILE_FIELDS = 'id,name,mimeType,size,modifiedTime,parents';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  parents?: string[];
}

/** Maps Drive HTTP errors to provider error codes. */
export async function driveError(res: Response): Promise<StorageProviderError> {
  let reason = '';
  try {
    const body = (await res.json()) as { error?: { errors?: { reason?: string }[]; message?: string } };
    reason = body.error?.errors?.[0]?.reason ?? body.error?.message ?? '';
  } catch {
    // non-JSON body
  }
  if (res.status === 401) return new StorageProviderError('auth-expired', 'google-drive', reason);
  if (res.status === 404) return new StorageProviderError('not-found', 'google-drive', reason);
  if (res.status === 403 && /quota|storage/i.test(reason)) return new StorageProviderError('quota', 'google-drive', reason);
  return new StorageProviderError('unknown', 'google-drive', `${res.status} ${reason}`);
}

/**
 * Authorised JSON request. Retries once with a refreshed token on 401.
 * `getToken(true)` must return a refreshed token (or throw auth-expired).
 */
export async function driveFetch<T>(
  getToken: (forceRefresh?: boolean) => Promise<string>,
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const run = async (token: string) => {
    try {
      return await fetch(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } });
    } catch (e) {
      throw new StorageProviderError('network', 'google-drive', e instanceof Error ? e.message : String(e));
    }
  };
  let res = await run(await getToken());
  if (res.status === 401) res = await run(await getToken(true));
  if (!res.ok) throw await driveError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Escapes a value for a Drive `q` query string literal. */
export function q(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
