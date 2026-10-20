/**
 * Default store: AsyncStorage. Platform versions: IndexedDB on the web
 * (platformKeyValue.web.ts) and SQLite on iOS / Android (.native.ts).
 */
import { asyncStorageStore } from './asyncStorageStore';
import type { KeyValueStore } from './keyValueStore';

export const platformKeyValueStore: KeyValueStore = asyncStorageStore;
