import { readJson, storageKeys, writeJson, type KeyValueStore } from '@/storage/keyValueStore';
import type { SyncableRepository } from '@/storage/repository';
import type { BaseEntity } from '@/types/entity';
import { SyncError, type PushResult, type RemoteRecord, type RemoteStore, type SyncResult, type SyncState } from './types';

const PUSH_BATCH = 200;
const MAX_PULL_PAGES = 50;
/** A sync that takes longer is given up (a hung connection must not block every later sync). */
const SYNC_TIMEOUT_MS = 90_000;

export const emptySyncState = (): SyncState => ({ cursor: null, lastSyncAt: null, lastError: null });

/** Strips local-only fields before a row leaves the device. */
function toServer(row: BaseEntity): BaseEntity {
  const { dirty: _dirty, space: _space, ...data } = row;
  return data;
}

const toLocal = (r: RemoteRecord): BaseEntity => ({ ...r.data, updatedAt: r.updatedAt, deletedAt: r.deletedAt });

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
  /** A sync asked for while another was running: runs right after it (it may carry newer changes). */
  private queued: Promise<SyncResult> | null = null;
  private queuedFull = false;
  private stopped = false;

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

  /**
   * A call while a sync runs is queued to run right after it (once, however
   * many calls), so a change made meanwhile is never left behind. `full`
   * downloads everything again (repair, or right after joining a family). A
   * run that hangs is abandoned after SYNC_TIMEOUT_MS so the next can start.
   */
  /** True once stopped (account being deleted): nothing is sent or received any more. */
  get isStopped(): boolean {
    return this.stopped;
  }

  /** Stops syncing for good, after any run in progress. */
  async stop(): Promise<void> {
    this.stopped = true;
    await this.running?.catch(() => undefined);
    await this.queued?.catch(() => undefined);
  }

  sync(opts: { full?: boolean } = {}): Promise<SyncResult> {
    if (this.stopped) return Promise.resolve({ pushed: 0, pulled: 0, at: new Date().toISOString() });
    if (this.running) {
      this.queuedFull ||= !!opts.full;
      this.queued ??= this.running
        .catch(() => undefined)
        .then(() => {
          const full = this.queuedFull;
          this.queued = null;
          this.queuedFull = false;
          return this.sync({ full });
        });
      return this.queued;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new SyncError('offline', 'Sync timed out')), SYNC_TIMEOUT_MS);
    });
    const run = Promise.race([this.run(opts.full ?? false), timeout]).finally(() => {
      clearTimeout(timer);
      if (this.running === run) this.running = null;
    });
    this.running = run;
    return this.running;
  }

  /** Merges rows that arrived live (watch). Returns how many local rows changed. */
  async applyRemote(records: RemoteRecord[]): Promise<number> {
    if (this.stopped) return 0;
    const byCollection = new Map<string, BaseEntity[]>();
    for (const r of records) {
      if (!this.collections.has(r.collection)) continue;
      byCollection.set(r.collection, [...(byCollection.get(r.collection) ?? []), toLocal(r)]);
    }
    let changed = 0;
    for (const [collection, rows] of byCollection) changed += await this.collections.get(collection)!.mergeRemote(rows);
    return changed;
  }

  /** Live updates from the backend, if it has them. Returns stop. */
  watch(handlers: { onChanged: () => void; onAccess: () => void }): () => void {
    if (!this.remote.watch) return () => undefined;
    return this.remote.watch({
      onRecords: (records) =>
        void this.applyRemote(records)
          .then((n) => n > 0 && handlers.onChanged())
          .catch(() => undefined),
      onAccess: handlers.onAccess,
    });
  }

  private async run(full: boolean): Promise<SyncResult> {
    const state = await this.getState();
    // New pulled-row format: download everything once.
    if (this.remote.pullSchema && state.pullSchema !== this.remote.pullSchema) full = true;
    if (full) state.cursor = null;
    try {
      // 0. New server row format: upload everything once.
      const upgrading = !!this.remote.schema && state.schema !== this.remote.schema;
      if (upgrading) for (const repo of this.collections.values()) await repo.markAllDirty();
      // I joined someone's family: upload my rows again so my family data moves there. (Leaving does
      // not move anything back: what I added to that family stays in it.)
      const layout = this.remote.layout ? await this.remote.layout() : undefined;
      if (layout !== undefined && layout !== (state.layout ?? this.userId) && layout !== this.userId)
        for (const repo of this.collections.values()) await repo.markAllDirty((r) => r.ownerId === this.userId);

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
          restored.set(r.collection, [...(restored.get(r.collection) ?? []), toLocal(r)]);
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
          byCollection.set(r.collection, [...(byCollection.get(r.collection) ?? []), toLocal(r)]);
        }
        for (const [collection, rows] of byCollection) pulled += await this.collections.get(collection)!.mergeRemote(rows);
        state.cursor = res.cursor ?? state.cursor;
        await this.setState(state);
        if (!res.hasMore) break;
      }

      // 3. Someone stopped sharing with me: their rows leave this device too.
      if (this.remote.isGone) {
        for (const [collection, repo] of this.collections) {
          const gone = (await repo.listAllRaw()).filter((r) => r.ownerId !== this.userId && this.remote.isGone!(collection, r));
          if (gone.length) {
            await repo.forget(gone.map((r) => r.id));
            pulled += gone.length;
          }
        }
      }

      const at = new Date().toISOString();
      await this.setState({
        ...state,
        lastSyncAt: at,
        lastError: null,
        ...(this.remote.schema ? { schema: this.remote.schema } : {}),
        ...(this.remote.pullSchema ? { pullSchema: this.remote.pullSchema } : {}),
        ...(layout !== undefined ? { layout } : {}),
      });
      return { pushed: outgoing.length, pulled, at };
    } catch (e) {
      await this.setState({ ...state, lastError: e instanceof Error ? e.message : String(e) });
      throw e;
    }
  }
}
