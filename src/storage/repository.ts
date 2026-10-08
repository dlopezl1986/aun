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
  /** Marks every row (tombstones included) as changed, to upload everything again. */
  markAllDirty(): Promise<void>;
  /** Replaces rows with the server's version, whatever their local state (rejected changes). */
  restoreRemote(rows: T[]): Promise<void>;
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
  ) {
    this.key = storageKeys.user(userId, collection);
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
    return this.mutate((rows) => ({ rows: [...rows, entity], result: entity }));
  }

  update(id: string, patch: EntityPatch<T>): Promise<T> {
    return this.mutate((rows) => {
      const index = rows.findIndex((r) => r.id === id && !r.deletedAt);
      if (index < 0) throw new EntityNotFoundError(this.collection, id);
      const updated = { ...rows[index], ...patch, updatedAt: this.now().toISOString(), dirty: true } as T;
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
    return this.mutate((rows) => {
      const known = new Set(rows.map((r) => r.id));
      const added = incoming.filter((r) => !known.has(r.id)).map((r) => ({ ...r, ownerId: this.userId, dirty: true }) as T);
      return { rows: added.length ? [...rows, ...added] : rows, result: added.length };
    });
  }

  markAllDirty(): Promise<void> {
    return this.mutate((rows) => ({ rows: rows.map((r) => ({ ...r, dirty: true })), result: undefined }));
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
    const stamp = this.now().toISOString();
    return this.mutate((rows) => ({
      rows: rows.map((r) => (set.has(r.id) ? { ...r, deletedAt: stamp, updatedAt: stamp, dirty: true } : r)),
      result: undefined,
    }));
  }
}
