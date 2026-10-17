import type { Services } from '@/services/container';
import type { KeyValueStore } from '@/storage/keyValueStore';
import { deleteLocalUserData } from './localAccountData';
import { wipeUserContent } from './wipe';

/**
 * Everything "Eliminar mi cuenta" removes besides the login itself, in order:
 *  1. stop syncing (nothing may be uploaded again),
 *  2. device-side clean-up: document files, e-mail access revoked,
 *  3. on the server: every row, space, invitation and notice of mine,
 *  4. everything this device stores for the account.
 * Called by the auth gateway after the password check, before the account goes.
 */
export async function deleteAccountData(services: Services, kv: KeyValueStore): Promise<void> {
  await services.sync?.stop();
  await wipeUserContent(services, kv);
  if (services.sharing) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { deleteFirebaseAccountData } = require('./firebaseAccountData') as typeof import('./firebaseAccountData');
    await deleteFirebaseAccountData(services.userId);
  }
  await deleteLocalUserData(services.userId);
}
