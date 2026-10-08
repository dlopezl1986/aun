import type { BaseEntity } from '@/types/entity';

/** One user-data row as stored on the server. */
export interface RemoteRecord {
  collection: string;
  id: string;
  data: BaseEntity;
  /** Client-side last modification (last-write-wins key). */
  updatedAt: string;
  deletedAt: string | null;
}

export interface PullPage {
  records: RemoteRecord[];
  /** Opaque server cursor (server-side modification time) to resume from. */
  cursor: string | null;
  /** More pages available right now. */
  hasMore: boolean;
}

/**
 * Backend contract for sync. Implemented by SupabaseRemoteStore (REST); a
 * custom API or another BaaS only needs these two calls.
 */
export interface RemoteStore {
  readonly id: string;
  /**
   * Rows changed after `cursor`. `overlapMs` re-reads a small window before it
   * (first page of a sync) so rows committed late by concurrent writers are
   * never missed; merging them twice is harmless.
   */
  pull(cursor: string | null, opts?: { overlapMs?: number }): Promise<PullPage>;
  /** Idempotent upsert; the server keeps the newest `updatedAt` per row. */
  push(records: RemoteRecord[]): Promise<void>;
}

export interface SyncState {
  /** Server cursor of the last pull. */
  cursor: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  at: string;
}

export class SyncError extends Error {
  constructor(
    readonly code: 'offline' | 'unauthorized' | 'server' | 'not-configured',
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'SyncError';
  }
}
