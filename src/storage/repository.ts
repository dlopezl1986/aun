import type { BaseEntity, EntityInput, EntityPatch } from '@/types/entity';
import { createId } from '@/utils/id';
import { readJson, storageKeys, writeJson, type KeyValueStore } from './keyValueStore';

/**
 * Persistence contract used by every domain service. Services never know
 * whether data lives on the device or in a remote backend.
 */
export interface Repository<T extends BaseEntity> {
  list(): Promise<T[]>;
  get(id: string): Promise<T | null>;
  create(input: EntityInput<T>): Promise<T>;
  update(id: string, patch: EntityPatch<T>): Promise<T>;
  /** Soft delete (tombstone) — keeps the record for future sync. */
  remove(id: string): Promise<void>;
  removeMany(ids: string[]): Promise<void>;
}

export class EntityNotFoundError extends Error {
  constructor(collection: string, id: string) {
    super(`${collection}/${id} not found`);
    this.name = 'EntityNotFoundError';
  }
}

/**
 * Local repository: one JSON document per (user, collection) in the KV store,
 * cached in memory. Writes are serialised to avoid lost updates.
 * Good for the MVP volumes (hundreds/thousands of rows). For larger data sets
 * it can be replaced by a SQLite implementation with the same interface.
 */
/** Extra capabilities the sync engine needs (raw rows incl. tombstones + remote merge). */
export interface SyncableRepository<T extends BaseEntity = BaseEntity> extends Repository<T> {
  readonly collection: string;
  /** Every row, deleted ones included (tombstones must be synced too). */
  listAllRaw(): Promise<T[]>;
  /** Last-write-wins merge of rows coming from the server. Returns how many rows changed. */
  mergeRemote(rows: T[]): Promise<number>;
  /** Marks pushed rows as synced, unless they changed again meanwhile. */
  markClean(rows: { id: string; updatedAt: string }[]): Promise<void>;
  /** Adds rows from elsewhere (data migration) as local changes; existing ids are kept. */
  importRows(rows: T[]): Promise<number>;
  /** Marks every row (tombstones included; or those matching `which`) as changed, to upload them again. */
  markAllDirty(which?: (row: T) => boolean): Promise<void>;
  /** Drops rows from this device only (no tombstone): data we can no longer see. */
  forget(ids: string[]): Promise<void>;
  /** Replaces rows with the server's version, whatever their local state (rejected changes). */
  restoreRemote(rows: T[]): Promise<void>;
}

/** Listener for changes made on this device (not the ones that come from the server). */
export type LocalChangeListener = (collection: string) => void;

/**
 * Time stamp of an edit: now, but always after the version being replaced, so
 * an edit made right after receiving a row from a device whose clock runs
 * ahead still counts as the newest (last-write-wins stays in edit order).
 */
export function nextStamp(now: Date, previous?: string): string {
  const stamp = now.toISOString();
  if (!previous || stamp > previous) return stamp;
  const prev = Date.parse(previous);
  return Number.isNaN(prev) ? stamp : new Date(prev + 1).toISOString();
}

export class LocalRepository<T extends BaseEntity> implements SyncableRepository<T> {
  private cache: T[] | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly key: string;

  constructor(
    private readonly store: KeyValueStore,
    private readonly userId: string,
    readonly collection: string,
    private readonly now: () => Date = () => new Date(),
    private readonly onLocalChange: LocalChangeListener = () => undefined,
  ) {
    this.key = storageKeys.user(userId, collection);
  }

  /** A local write: persisted, then announced (so it can be synced right away). */
  private change<R>(fn: (rows: T[]) => { rows: T[]; result: R }): Promise<R> {
    return this.mutate(fn).then((result) => {
      this.onLocalChange(this.collection);
      return result;
    });
  }

  private async load(): Promise<T[]> {
    if (!this.cache) this.cache = await readJson<T[]>(this.store, this.key, []);
    return this.cache;
  }

  private mutate<R>(fn: (rows: T[]) => { rows: T[]; result: R }): Promise<R> {
    const run = this.queue.then(async () => {
      const current = await this.load();
      const { rows, result } = fn(current);
      await writeJson(this.store, this.key, rows);
      this.cache = rows;
      return result;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async list(): Promise<T[]> {
    await this.queue;
    return (await this.load()).filter((r) => !r.deletedAt);
  }

  async get(id: string): Promise<T | null> {
    return (await this.list()).find((r) => r.id === id) ?? null;
  }

  create(input: EntityInput<T>): Promise<T> {
    const stamp = this.now().toISOString();
    const entity = {
      ...input,
      id: createId(),
      ownerId: this.userId,
      createdAt: stamp,
      updatedAt: stamp,
      deletedAt: null,
      dirty: true,
    } as T;
    return this.change((rows) => ({ rows: [...rows, entity], result: entity }));
  }

  update(id: string, patch: EntityPatch<T>): Promise<T> {
    return this.change((rows) => {
      const index = rows.findIndex((r) => r.id === id && !r.deletedAt);
      if (index < 0) throw new EntityNotFoundError(this.collection, id);
      const updated = { ...rows[index], ...patch, updatedAt: nextStamp(this.now(), rows[index].updatedAt), dirty: true } as T;
      const next = rows.slice();
      next[index] = updated;
      return { rows: next, result: updated };
    });
  }

  remove(id: string): Promise<void> {
    return this.removeMany([id]);
  }

  async listAllRaw(): Promise<T[]> {
    await this.queue;
    return (await this.load()).slice();
  }

  mergeRemote(incoming: T[]): Promise<number> {
    return this.mutate((rows) => {
      const byId = new Map(rows.map((r, i) => [r.id, i]));
      const next = rows.slice();
      let changed = 0;
      for (const remote of incoming) {
        const row = { ...remote, dirty: false } as T;
        const i = byId.get(remote.id);
        if (i === undefined) {
          byId.set(remote.id, next.length);
          next.push(row);
          changed += 1;
        } else if (remote.updatedAt > next[i].updatedAt || (remote.updatedAt === next[i].updatedAt && next[i].dirty !== false)) {
          // Newer on the server (last write wins), or the server confirms our version.
          next[i] = row;
          changed += 1;
        }
      }
      return { rows: changed ? next : rows, result: changed };
    });
  }

  importRows(incoming: T[]): Promise<number> {
    return this.change((rows) => {
      const known = new Set(rows.map((r) => r.id));
      const added = incoming.filter((r) => !known.has(r.id)).map((r) => ({ ...r, ownerId: this.userId, dirty: true }) as T);
      return { rows: added.length ? [...rows, ...added] : rows, result: added.length };
    });
  }

  markAllDirty(which: (row: T) => boolean = () => true): Promise<void> {
    return this.mutate((rows) => ({ rows: rows.map((r) => (which(r) ? { ...r, dirty: true } : r)), result: undefined }));
  }

  forget(ids: string[]): Promise<void> {
    const set = new Set(ids);
    return this.mutate((rows) => ({ rows: rows.filter((r) => !set.has(r.id)), result: undefined }));
  }

  restoreRemote(incoming: T[]): Promise<void> {
    const byId = new Map(incoming.map((r) => [r.id, r]));
    return this.mutate((rows) => {
      const known = new Set(rows.map((r) => r.id));
      const next = rows.map((r) => (byId.has(r.id) ? ({ ...byId.get(r.id)!, dirty: false } as T) : r));
      for (const r of incoming) if (!known.has(r.id)) next.push({ ...r, dirty: false } as T);
      return { rows: next, result: undefined };
    });
  }

  markClean(pushed: { id: string; updatedAt: string }[]): Promise<void> {
    const versions = new Map(pushed.map((p) => [p.id, p.updatedAt]));
    return this.mutate((rows) => ({
      rows: rows.map((r) => (versions.get(r.id) === r.updatedAt && r.dirty !== false ? { ...r, dirty: false } : r)),
      result: undefined,
    }));
  }

  removeMany(ids: string[]): Promise<void> {
    const set = new Set(ids);
    const now = this.now();
    return this.change((rows) => ({
      rows: rows.map((r) => {
        if (!set.has(r.id)) return r;
        const stamp = nextStamp(now, r.updatedAt);
        return { ...r, deletedAt: stamp, updatedAt: stamp, dirty: true };
      }),
      result: undefined,
    }));
  }
}
