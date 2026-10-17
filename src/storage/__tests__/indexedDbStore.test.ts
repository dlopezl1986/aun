import { IDBFactory } from 'fake-indexeddb';

import { createIndexedDbStore } from '../indexedDbStore';

/** Minimal Web Storage (localStorage) for the migration. */
function legacyStorage(initial: Record<string, string>): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  };
}

describe('web storage (IndexedDB)', () => {
  it('moves AUN data out of localStorage once, leaving everything else there', async () => {
    const legacy = legacyStorage({
      'aun:v1:u:me:tasks': '[{"id":"t1"}]',
      'aun:v1:auth:accounts': '[]',
      'aun.session': 'keep-me',
      'aun:v1:device:preferences': '{"shiftColors":{}}',
      'firebase:authUser': 'keep-me-too',
    });
    const factory = new IDBFactory();
    const store = createIndexedDbStore(factory, legacy);
    expect(await store.getItem('aun:v1:u:me:tasks')).toBe('[{"id":"t1"}]');
    expect(legacy.getItem('aun:v1:u:me:tasks')).toBeNull();
    expect(legacy.getItem('aun.session')).toBe('keep-me');
    expect(legacy.getItem('aun:v1:device:preferences')).toBe('{"shiftColors":{}}');
    expect(legacy.getItem('firebase:authUser')).toBe('keep-me-too');

    // A later start does not migrate again (nor overwrite newer data).
    await store.setItem('aun:v1:u:me:tasks', '[]');
    legacy.setItem('aun:v1:u:me:tasks', 'stale');
    const again = createIndexedDbStore(factory, legacy);
    expect(await again.getItem('aun:v1:u:me:tasks')).toBe('[]');
  });

  it('stores, lists by prefix and removes values bigger than localStorage allows', async () => {
    const store = createIndexedDbStore(new IDBFactory(), null);
    const big = 'x'.repeat(8 * 1024 * 1024); // 8 MB: over the ~5 MB localStorage cap
    await store.setItem('aun:v1:u:me:events', big);
    await store.setItem('aun:v1:u:me:tasks', '[]');
    await store.setItem('aun:v1:u:other:tasks', '[]');
    expect((await store.getItem('aun:v1:u:me:events'))?.length).toBe(big.length);
    expect((await store.keys!('aun:v1:u:me:')).sort()).toEqual(['aun:v1:u:me:events', 'aun:v1:u:me:tasks']);
    await store.removeItem('aun:v1:u:me:events');
    expect(await store.getItem('aun:v1:u:me:events')).toBeNull();
  });
});
