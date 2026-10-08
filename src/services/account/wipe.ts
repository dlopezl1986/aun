import type { Services } from '@/services/container';
import { storageKeys, type KeyValueStore } from '@/storage/keyValueStore';
import { getStorageProvider } from '@/storage/providers/factory';
import type { StoredFileRef } from '@/storage/providers/types';

export interface WipeResult {
  /** Rows deleted across every module. */
  rows: number;
  /** Document/photo files that could not be removed from their storage (left there). */
  filesKept: number;
  /** E-mail accounts disconnected (access revoked; no e-mail deleted). */
  emailAccounts: number;
}

/**
 * "Borrar todo el contenido": empties every module of the signed-in account
 * — tasks, calendars and events, 2ndBrain folders and documents (their files
 * too: removed from this device, moved to the trash on Google Drive), family,
 * reminders, notifications and links — and disconnects e-mail accounts.
 * The account itself and its preferences (style, language, modules, Inicio)
 * are kept. Rows become tombstones so the deletion also syncs to the backend.
 */
export async function wipeUserContent(services: Services, kv: KeyValueStore): Promise<WipeResult> {
  const result: WipeResult = { rows: 0, filesKept: 0, emailAccounts: 0 };

  // 1. Document binaries (through their provider), then any metadata left.
  const docs = await services.collections.get('documents')!.list();
  if (docs.length) {
    const r = await services.secondBrain.deleteDocuments(docs.map((d) => d.id));
    result.filesKept += r.failed.length;
  }

  // 2. Children's photos (device-only files).
  for (const child of await services.family.listChildren()) {
    const photo = (child as { photo?: StoredFileRef | null }).photo;
    if (!photo) continue;
    try {
      await getStorageProvider('local', services.userId).deleteFile(photo);
    } catch {
      result.filesKept += 1;
    }
  }

  // 3. E-mail: revoke access and forget tokens (demo mailboxes are local data).
  for (const account of await services.email.listAccounts()) {
    await services.email.disconnect(account);
    await kv.removeItem(storageKeys.user(services.userId, `demoMail:${account.id}`));
    result.emailAccounts += 1;
  }

  // 4. Every synced collection → tombstones.
  for (const repo of services.collections.values()) {
    const ids = (await repo.list()).map((r) => r.id);
    if (!ids.length) continue;
    await repo.removeMany(ids);
    result.rows += ids.length;
  }
  return result;
}
