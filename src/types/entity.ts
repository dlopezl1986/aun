/**
 * Every persisted domain object extends BaseEntity. The fields are chosen so
 * that a future sync engine (Phase 9) can reconcile local and remote copies:
 *  - `id` is a client-generated UUID (no server round-trip needed to create).
 *  - `updatedAt` enables last-write-wins / change detection.
 *  - `deletedAt` is a tombstone (soft delete) so deletions can be synced.
 */
export interface BaseEntity {
  id: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  /**
   * Local-only sync flag: true (or missing) = changed on this device and not
   * pushed yet. Clock-independent, never sent to the server.
   */
  dirty?: boolean;
}

export type EntityInput<T extends BaseEntity> = Omit<T, keyof BaseEntity>;
export type EntityPatch<T extends BaseEntity> = Partial<EntityInput<T>>;

/** Reference to any entity in any module — the backbone of cross-module relations. */
export interface EntityRef {
  module: string;
  type: string;
  id: string;
}

export type ISODateString = string;
