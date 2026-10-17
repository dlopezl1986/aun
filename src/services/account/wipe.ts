import type { Services } from '@/services/container';
import { FAMILY_COLLECTIONS, householdOwner } from '@/services/sharing/spaces';
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
 *
 * Only what is mine and not shared by someone else: rows of other people
 * (their calendars, events, shopping…) and my rows inside a family or
 * calendar that belongs to someone else are left alone.
 */
export async function wipeUserContent(services: Services, kv: KeyValueStore): Promise<WipeResult> {
  const result: WipeResult = { rows: 0, filesKept: 0, emailAccounts: 0 };
  const me = services.userId;
  const spaces = services.sharing ? await services.sharing.spaces().catch(() => null) : [];
  // Not knowing whose family I am in, leave family data alone rather than delete someone else's.
  const inOtherFamily = spaces === null || householdOwner(spaces, me) !== me;
  const calendarOwner = new Map((await services.collections.get('calendars')!.listAllRaw()).map((c) => [c.id, c.ownerId]));
  const isMine = (collection: string, row: { ownerId: string; calendarId?: string | null }) =>
    row.ownerId === me &&
    !(FAMILY_COLLECTIONS.has(collection) && inOtherFamily) &&
    !(collection === 'events' && row.calendarId && calendarOwner.get(row.calendarId) !== me);

  // 1. Document binaries (through their provider), then any metadata left.
  const docs = await services.collections.get('documents')!.list();
  if (docs.length) {
    const r = await services.secondBrain.deleteDocuments(docs.map((d) => d.id));
    result.filesKept += r.failed.length;
  }

  // 2. Children's photos (device-only files).
  for (const child of await services.family.listChildren()) {
    if (!isMine('children', child)) continue;
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
  for (const [collection, repo] of services.collections) {
    const ids = (await repo.list()).filter((r) => isMine(collection, r as never)).map((r) => r.id);
    if (!ids.length) continue;
    await repo.removeMany(ids);
    result.rows += ids.length;
  }
  return result;
}
