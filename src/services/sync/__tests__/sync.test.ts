import { createServices } from '@/services/container';
import { SupabaseClient } from '@/services/backend/supabase';
import { memoryStore } from '@/test/memoryStore';
import { storageKeys, writeJson } from '@/storage/keyValueStore';
import { migrateLocalData, summarizeLocalData } from '../migration';
import { SupabaseRemoteStore } from '../supabaseRemote';
import type { PullPage, RemoteRecord, RemoteStore } from '../types';

// jest.mock factories run lazily and must use require().
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
let mockId = 0;
jest.mock('@/utils/id', () => ({ createId: () => `id-${++mockId}` }));

/** In-memory server with the same rules as supabase/migrations (LWW + server cursor). */
class FakeServer {
  rows = new Map<string, RemoteRecord & { serverAt: number }>();
  private clock = 0;
  pushes = 0;
  store(): RemoteStore {
    return {
      id: 'fake',
      pull: async (cursor): Promise<PullPage> => {
        const since = cursor ? Number(cursor) : -1;
        const records = [...this.rows.values()].filter((r) => r.serverAt > since).sort((a, b) => a.serverAt - b.serverAt);
        return { records, cursor: records.length ? String(records[records.length - 1].serverAt) : cursor, hasMore: false };
      },
      push: async (records) => {
        this.pushes += 1;
        for (const r of records) {
          const key = `${r.collection}/${r.id}`;
          const existing = this.rows.get(key);
          if (existing && existing.updatedAt > r.updatedAt) continue;
          this.rows.set(key, { ...r, serverAt: ++this.clock });
        }
      },
    };
  }
}

describe('SyncEngine', () => {
  it('syncs two devices, deletions included, and becomes idle (nothing pending)', async () => {
    const server = new FakeServer();
    const phone = createServices('u1', memoryStore(), server.store());
    const laptop = createServices('u1', memoryStore(), server.store());

    const task = await phone.tasks.quickAdd({ title: 'Comprar pan', dueDate: '2026-10-08' });
    await phone.calendars.createCalendar({ name: 'Familia', color: '#f00' });
    const r1 = await phone.sync!.sync();
    expect(r1.pushed).toBe(2);
    expect(await phone.sync!.pending()).toHaveLength(0);

    await laptop.sync!.sync();
    expect((await laptop.tasks.list()).map((t) => t.title)).toEqual(['Comprar pan']);
    expect(await laptop.sync!.pending()).toHaveLength(0); // pulled rows do not bounce back

    await laptop.tasks.remove(task.id);
    await laptop.sync!.sync();
    await phone.sync!.sync();
    expect(await phone.tasks.list()).toHaveLength(0);
  });

  it('resolves concurrent edits with last-write-wins and never sends local-only fields', async () => {
    const server = new FakeServer();
    const a = createServices('u1', memoryStore(), server.store());
    const b = createServices('u1', memoryStore(), server.store());
    const t = await a.tasks.quickAdd({ title: 'Original' });
    await a.sync!.sync();
    await b.sync!.sync();

    await a.tasks.update(t.id, { title: 'Desde A' });
    await new Promise((r) => setTimeout(r, 5));
    await b.tasks.update(t.id, { title: 'Desde B (más reciente)' });
    await b.sync!.sync();
    await a.sync!.sync(); // A pushes an OLDER version: the server keeps B's
    await b.sync!.sync();
    expect((await a.tasks.get(t.id))?.title).toBe('Desde B (más reciente)');
    expect((await b.tasks.get(t.id))?.title).toBe('Desde B (más reciente)');
    for (const row of server.rows.values()) expect('dirty' in row.data).toBe(false);
  });

  it('keeps local changes when offline and retries later', async () => {
    const server = new FakeServer();
    const remote = server.store();
    let online = false;
    const flaky: RemoteStore = {
      id: 'fake',
      pull: (c) => remote.pull(c),
      push: (r) => (online ? remote.push(r) : Promise.reject(new Error('offline'))),
    };
    const s = createServices('u1', memoryStore(), flaky);
    await s.notifications.createReminder({ title: 'Regalo', date: '2026-10-09', time: '18:00' });
    await expect(s.sync!.sync()).rejects.toThrow('offline');
    expect((await s.sync!.getState()).lastError).toBe('offline');
    expect(await s.sync!.pending()).toHaveLength(1);
    online = true;
    await s.sync!.sync();
    expect(await s.sync!.pending()).toHaveLength(0);
    expect(server.rows.size).toBe(1);
  });
});

describe('local → account migration', () => {
  it('copies a local account into the signed-in account as pending changes, files included', async () => {
    const kv = memoryStore();
    await writeJson(kv, storageKeys.user('local-1', 'tasks'), [
      {
        id: 't1',
        ownerId: 'local-1',
        title: 'De antes',
        status: 'pending',
        createdAt: 'x',
        updatedAt: '2026-10-01T00:00:00.000Z',
        deletedAt: null,
      },
      {
        id: 't2',
        ownerId: 'local-1',
        title: 'Borrada',
        status: 'pending',
        createdAt: 'x',
        updatedAt: 'x',
        deletedAt: '2026-10-02T00:00:00.000Z',
      },
    ]);
    await writeJson(kv, storageKeys.user('local-1', 'documents'), [
      {
        id: 'd1',
        ownerId: 'local-1',
        name: 'a.pdf',
        mimeType: 'application/pdf',
        storage: { providerId: 'local', providerFileId: 'f1' },
        updatedAt: 'x',
      },
    ]);
    expect((await summarizeLocalData(kv, 'local-1')).rows).toBe(2);

    const cloud = createServices('cloud-9', kv, null);
    const copyFile = jest.fn(async () => ({ providerId: 'local', providerFileId: 'f1-copy' }));
    const result = await migrateLocalData(kv, 'local-1', cloud, copyFile);
    expect(result).toEqual({ rows: 2, files: 1, failedFiles: 0 });
    const tasks = await cloud.tasks.list();
    expect(tasks.map((t) => [t.title, t.ownerId, t.dirty])).toEqual([['De antes', 'cloud-9', true]]);
    const docs = await cloud.collections.get('documents')!.listAllRaw();
    expect((docs[0] as unknown as { storage: { providerFileId: string } }).storage.providerFileId).toBe('f1-copy');
    // Running it again does not duplicate anything.
    expect((await migrateLocalData(kv, 'local-1', cloud, copyFile)).rows).toBe(0);
  });
});

describe('SupabaseRemoteStore', () => {
  const calls: { url: string; method: string; headers: Record<string, string>; body?: string }[] = [];
  beforeEach(() => {
    calls.length = 0;
    let first = true;
    globalThis.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      calls.push({ url: String(url), method: init?.method ?? 'GET', headers, body: init?.body as string | undefined });
      if (String(url).includes('/auth/v1/token?grant_type=refresh_token'))
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ access_token: 'new', refresh_token: 'r2', expires_in: 3600, user: { id: 'u' } }),
        } as Response;
      if (first && String(url).includes('/rest/v1/')) {
        first = false;
        return { ok: false, status: 401, statusText: 'Unauthorized', text: async () => '{"message":"JWT expired"}' } as Response;
      }
      const body = String(url).includes('/rest/v1/records')
        ? JSON.stringify([
            {
              collection: 'tasks',
              id: 't1',
              data: { id: 't1' },
              updated_at: 'u1',
              deleted_at: null,
              server_updated_at: '2026-10-07T10:00:00.000Z',
            },
          ])
        : '';
      return { ok: true, status: 200, text: async () => body } as Response;
    }) as typeof fetch;
  });

  it('pulls with RLS-scoped REST calls, refreshing an expired token once', async () => {
    const secure = memoryStore();
    const client = new SupabaseClient({ url: 'https://x.supabase.co', anonKey: 'anon' }, { ...secure, isPersistent: true });
    await client.setSession({ accessToken: 'old', refreshToken: 'r1', expiresAt: Date.now() + 3_600_000, user: { id: 'u' } });
    const remote = new SupabaseRemoteStore(client);
    const page = await remote.pull('2026-10-07T09:00:00.000Z', { overlapMs: 5000 });
    expect(page.records[0]).toMatchObject({ collection: 'tasks', id: 't1', updatedAt: 'u1' });
    expect(page.cursor).toBe('2026-10-07T10:00:00.000Z');
    const last = calls[calls.length - 1];
    expect(last.headers.Authorization).toBe('Bearer new');
    expect(last.headers.apikey).toBe('anon');
    expect(decodeURIComponent(last.url)).toContain('server_updated_at=gt.2026-10-07T08:59:55.000Z');
    await remote.push([{ collection: 'tasks', id: 't1', data: { id: 't1' } as never, updatedAt: 'u2', deletedAt: null }]);
    expect(calls[calls.length - 1].url).toMatch(/\/rest\/v1\/rpc\/sync_push$/);
  });
});
