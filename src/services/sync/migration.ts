import { SYNCED_COLLECTIONS, type Services } from '@/services/container';
import { readJson, storageKeys, writeJson, type KeyValueStore } from '@/storage/keyValueStore';
import { getStorageProvider } from '@/storage/providers/factory';
import type { StoredFileRef } from '@/storage/providers/types';
import type { BaseEntity } from '@/types/entity';

export interface LocalDataSummary {
  rows: number;
  byCollection: Record<string, number>;
}

/** What a local (device-only) account holds, to offer copying it to the cloud account. */
export async function summarizeLocalData(kv: KeyValueStore, localUserId: string): Promise<LocalDataSummary> {
  const byCollection: Record<string, number> = {};
  let rows = 0;
  for (const c of SYNCED_COLLECTIONS) {
    const n = (await readJson<BaseEntity[]>(kv, storageKeys.user(localUserId, c), [])).filter((r) => !r.deletedAt).length;
    if (n) byCollection[c] = n;
    rows += n;
  }
  return { rows, byCollection };
}

type CopyFile = (ref: StoredFileRef, name: string, mimeType: string) => Promise<StoredFileRef>;

/** Copies a device-local file between the two users' private storage areas. */
export function localFileCopier(fromUserId: string, toUserId: string): CopyFile {
  return async (ref, name, mimeType) => {
    const from = getStorageProvider('local', fromUserId);
    const to = getStorageProvider('local', toUserId);
    const handle = await from.downloadFile(ref);
    try {
      const meta = await to.uploadFile({ uri: handle.uri, name, mimeType }, null);
      return { providerId: 'local', providerFileId: meta.providerFileId };
    } finally {
      handle.release?.();
    }
  };
}

export interface MigrationResult {
  rows: number;
  files: number;
  failedFiles: number;
}

/**
 * "Copiar los datos de este dispositivo a mi cuenta": imports every row of a
 * local account into the signed-in account (marked as pending changes, so the
 * next sync uploads them). Device-local files (documents, children's photos)
 * are copied into the new account's local storage; the local account itself
 * is left untouched.
 */
export async function migrateLocalData(
  kv: KeyValueStore,
  localUserId: string,
  target: Services,
  copyFile: CopyFile = localFileCopier(localUserId, target.userId),
): Promise<MigrationResult> {
  const result: MigrationResult = { rows: 0, files: 0, failedFiles: 0 };
  for (const collection of SYNCED_COLLECTIONS) {
    const rows = (await readJson<BaseEntity[]>(kv, storageKeys.user(localUserId, collection), [])).filter((r) => !r.deletedAt);
    if (!rows.length) continue;
    for (const row of rows as (BaseEntity & {
      storage?: StoredFileRef;
      photo?: StoredFileRef | null;
      name?: string;
      mimeType?: string;
    })[]) {
      const ref = collection === 'documents' ? row.storage : collection === 'children' ? row.photo : null;
      if (!ref || ref.providerId !== 'local') continue;
      try {
        const copied = await copyFile(ref, row.name ?? 'file', row.mimeType ?? 'application/octet-stream');
        if (collection === 'documents') row.storage = copied;
        else row.photo = copied;
        result.files += 1;
      } catch {
        result.failedFiles += 1;
      }
    }
    result.rows += await target.collections.get(collection)!.importRows(rows);
  }
  // Preferences (dashboard, modules, notifications) when the account has none yet.
  const settingsFrom = storageKeys.user(localUserId, 'settings');
  const settingsTo = storageKeys.user(target.userId, 'settings');
  const existing = await kv.getItem(settingsTo);
  if (!existing) {
    const local = await readJson<unknown>(kv, settingsFrom, null);
    if (local) await writeJson(kv, settingsTo, local);
  }
  return result;
}
