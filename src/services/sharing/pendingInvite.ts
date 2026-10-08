import { asyncKeyValueStore } from '@/storage/keyValueStore';

/** An invitation link opened before signing in, kept until the account exists. */
const KEY = 'aun.pendingInvite';

export const pendingInvite = {
  get: () => asyncKeyValueStore.getItem(KEY),
  set: (code: string) => asyncKeyValueStore.setItem(KEY, code),
  clear: () => asyncKeyValueStore.removeItem(KEY),
};
