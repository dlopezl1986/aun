import { readJson, storageKeys, writeJson, type KeyValueStore } from '@/storage/keyValueStore';
import type { SyncableRepository } from '@/storage/repository';
import type { BaseEntity } from '@/types/entity';
import type { PushResult, RemoteRecord, RemoteStore, SyncResult, SyncState } from './types';

const PUSH_BATCH = 200;
const MAX_PULL_PAGES = 50;

export const emptySyncState = (): SyncState => ({ cursor: null, lastSyncAt: null, lastError: null });

/** Strips local-only fields before a row leaves the device. */
function toServer(row: BaseEntity): BaseEntity {
  const { dirty: _dirty, ...data } = row;
  return data;
}

/**
 * Offline-first sync. The device is the source of truth for the UI; every
 * local change marks its row `dirty` (deletions are tombstones), so sync is:
 *   1. push dirty rows, then mark them clean (unless edited meanwhile),
 *   2. pull rows the server changed since the last cursor,
 *   3. merge with last-write-wins per row (`updatedAt`).
 * Clock-independent for change detection and idempotent: running it twice
 * is harmless.
 */
export class SyncEngine {
  private running: Promise<SyncResult> | null = null;

  constructor(
    private readonly collections: Map<string, SyncableRepository>,
    private readonly remote: RemoteStore,
    private readonly kv: KeyValueStore,
    private readonly userId: string,
  ) {}

  private get key() {
    return storageKeys.user(this.userId, `sync:${this.remote.id}`);
  }

  getState(): Promise<SyncState> {
    return readJson<SyncState>(this.kv, this.key, emptySyncState());
  }

  private setState(state: SyncState) {
    return writeJson(this.kv, this.key, state);
  }

  /** Rows changed on this device and not pushed yet. */
  async pending(): Promise<RemoteRecord[]> {
    const out: RemoteRecord[] = [];
    for (const [collection, repo] of this.collections) {
      for (const row of await repo.listAllRaw()) {
        if (row.dirty === false) continue;
        out.push({ collection, id: row.id, data: toServer(row), updatedAt: row.updatedAt, deletedAt: row.deletedAt ?? null });
      }
    }
    return out.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  }

  /** Concurrent calls share the same run. */
  sync(): Promise<SyncResult> {
    if (!this.running) {
      this.running = this.run().finally(() => {
        this.running = null;
      });
    }
    return this.running;
  }

  private async run(): Promise<SyncResult> {
    const state = await this.getState();
    try {
      // 0. New server row format: upload everything once.
      const upgrading = !!this.remote.schema && state.schema !== this.remote.schema;
      if (upgrading) for (const repo of this.collections.values()) await repo.markAllDirty();

      // 1. Push.
      const outgoing = await this.pending();
      for (let i = 0; i < outgoing.length; i += PUSH_BATCH) {
        const batch = outgoing.slice(i, i + PUSH_BATCH);
        const result = (await this.remote.push(batch)) as PushResult | void;
        const byCollection = new Map<string, { id: string; updatedAt: string }[]>();
        for (const r of batch) byCollection.set(r.collection, [...(byCollection.get(r.collection) ?? []), r]);
        for (const [collection, rows] of byCollection) await this.collections.get(collection)!.markClean(rows);
        // Changes the server did not accept (no permission): back to the server's version.
        const restored = new Map<string, BaseEntity[]>();
        for (const r of result?.restored ?? []) {
          if (!this.collections.has(r.collection)) continue;
          restored.set(r.collection, [
            ...(restored.get(r.collection) ?? []),
            { ...r.data, updatedAt: r.updatedAt, deletedAt: r.deletedAt },
          ]);
        }
        for (const [collection, rows] of restored) await this.collections.get(collection)!.restoreRemote(rows);
      }

      // 2. Pull + merge.
      let pulled = 0;
      for (let page = 0; page < MAX_PULL_PAGES; page++) {
        const res = await this.remote.pull(state.cursor, page === 0 ? { overlapMs: 5_000 } : undefined);
        const byCollection = new Map<string, BaseEntity[]>();
        for (const r of res.records) {
          if (!this.collections.has(r.collection)) continue; // from a newer client: ignore, keep on server
          byCollection.set(r.collection, [
            ...(byCollection.get(r.collection) ?? []),
            { ...r.data, updatedAt: r.updatedAt, deletedAt: r.deletedAt },
          ]);
        }
        for (const [collection, rows] of byCollection) pulled += await this.collections.get(collection)!.mergeRemote(rows);
        state.cursor = res.cursor ?? state.cursor;
        await this.setState(state);
        if (!res.hasMore) break;
      }

      const at = new Date().toISOString();
      await this.setState({ ...state, lastSyncAt: at, lastError: null, ...(this.remote.schema ? { schema: this.remote.schema } : {}) });
      return { pushed: outgoing.length, pulled, at };
    } catch (e) {
      await this.setState({ ...state, lastError: e instanceof Error ? e.message : String(e) });
      throw e;
    }
  }
}
