import { NetworkError, SupabaseHttpError, type SupabaseClient } from '@/services/backend/supabase';
import type { BaseEntity } from '@/types/entity';
import { SyncError, type PullPage, type RemoteRecord, type RemoteStore } from './types';

const PAGE = 500;

interface Row {
  collection: string;
  id: string;
  data: BaseEntity;
  updated_at: string;
  deleted_at: string | null;
  server_updated_at: string;
}

function mapError(e: unknown): never {
  if (e instanceof NetworkError) throw new SyncError('offline', e.message);
  if (e instanceof SupabaseHttpError && (e.status === 401 || e.status === 403)) throw new SyncError('unauthorized', e.message);
  throw new SyncError('server', e instanceof Error ? e.message : String(e));
}

/**
 * Sync over one generic table `public.records` (see supabase/migrations):
 * (user_id, collection, id, data jsonb, updated_at, deleted_at,
 * server_updated_at). Row Level Security restricts every row to its owner.
 */
export class SupabaseRemoteStore implements RemoteStore {
  readonly id = 'supabase';

  constructor(private readonly client: SupabaseClient) {}

  async pull(cursor: string | null, opts: { overlapMs?: number } = {}): Promise<PullPage> {
    const params = new URLSearchParams({
      select: 'collection,id,data,updated_at,deleted_at,server_updated_at',
      order: 'server_updated_at.asc',
      limit: String(PAGE),
    });
    if (cursor) {
      const since = new Date(new Date(cursor).getTime() - (opts.overlapMs ?? 0)).toISOString();
      params.set('server_updated_at', `gt.${since}`);
    }
    let rows: Row[];
    try {
      rows = await this.client.authed<Row[]>(`/rest/v1/records?${params}`);
    } catch (e) {
      mapError(e);
    }
    const records: RemoteRecord[] = rows.map((r) => ({
      collection: r.collection,
      id: r.id,
      data: r.data,
      updatedAt: r.updated_at,
      deletedAt: r.deleted_at,
    }));
    const last = rows[rows.length - 1]?.server_updated_at;
    // Never move the cursor backwards because of the overlap window.
    const next = last && (!cursor || last > cursor) ? last : cursor;
    return { records, cursor: next, hasMore: rows.length === PAGE };
  }

  async push(records: RemoteRecord[]): Promise<void> {
    if (!records.length) return;
    try {
      await this.client.authed('/rest/v1/rpc/sync_push', {
        method: 'POST',
        body: JSON.stringify({
          records: records.map((r) => ({
            collection: r.collection,
            id: r.id,
            data: r.data,
            updated_at: r.updatedAt,
            deleted_at: r.deletedAt,
          })),
        }),
      });
    } catch (e) {
      mapError(e);
    }
  }
}
