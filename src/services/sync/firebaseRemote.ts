/**
 * RemoteStore backed by Firestore.
 *
 * Every user-data row lives in `/records/{ownerId}_{collection}_{id}` so that
 * Firestore security rules can check `ownerId == request.auth.uid`.
 *
 * Pull reads changed rows (by `serverUpdatedAt`) and push upserts them in a
 * batched write with `serverTimestamp()` to keep the cursor monotonic.
 */
import { collection, doc, firebaseDb, getDocs, limit, orderBy, query, where, writeBatch } from '@/services/backend/firebase';
import { serverTimestamp, Timestamp } from 'firebase/firestore';
import type { BaseEntity } from '@/types/entity';
import { SyncError, type PullPage, type RemoteRecord, type RemoteStore } from './types';

const PAGE = 500;
const RECORDS = 'records';

/** Deterministic doc id so push is a natural upsert. */
function docId(ownerId: string, col: string, id: string) {
  return `${ownerId}_${col}_${id}`;
}

interface RecordDoc {
  ownerId: string;
  collection: string;
  id: string;
  data: BaseEntity;
  updatedAt: string;
  deletedAt: string | null;
  serverUpdatedAt: Timestamp;
}

function mapFirestoreError(e: unknown): never {
  const code = (e as { code?: string })?.code ?? '';
  const msg = e instanceof Error ? e.message : String(e);
  if (code.includes('unauthenticated') || code.includes('permission-denied')) throw new SyncError('unauthorized', msg);
  if (code.includes('unavailable') || code.includes('deadline-exceeded')) throw new SyncError('offline', msg);
  throw new SyncError('server', msg);
}

export class FirebaseRemoteStore implements RemoteStore {
  readonly id = 'firebase';

  constructor(private readonly ownerId: string) {}

  async pull(cursor: string | null, opts: { overlapMs?: number } = {}): Promise<PullPage> {
    const db = firebaseDb();
    const col = collection(db, RECORDS);

    const constraints = [where('ownerId', '==', this.ownerId), orderBy('serverUpdatedAt', 'asc'), limit(PAGE)];

    if (cursor) {
      const sinceMs = new Date(cursor).getTime() - (opts.overlapMs ?? 0);
      const since = Timestamp.fromMillis(sinceMs);
      constraints.splice(1, 0, where('serverUpdatedAt', '>', since));
    }

    let docs: RecordDoc[];
    try {
      const snap = await getDocs(query(col, ...constraints));
      docs = snap.docs.map((d) => d.data() as RecordDoc);
    } catch (e) {
      mapFirestoreError(e);
    }

    const records: RemoteRecord[] = docs.map((r) => ({
      collection: r.collection,
      id: r.id,
      data: r.data,
      updatedAt: r.updatedAt,
      deletedAt: r.deletedAt,
    }));

    const lastTs = docs[docs.length - 1]?.serverUpdatedAt;
    const lastIso = lastTs ? lastTs.toDate().toISOString() : null;
    const next = lastIso && (!cursor || lastIso > cursor) ? lastIso : cursor;

    return { records, cursor: next, hasMore: docs.length === PAGE };
  }

  async push(records: RemoteRecord[]): Promise<void> {
    if (!records.length) return;
    const db = firebaseDb();
    // Firestore batches max 500 writes.
    for (let i = 0; i < records.length; i += PAGE) {
      const batch = writeBatch(db);
      for (const r of records.slice(i, i + PAGE)) {
        const ref = doc(db, RECORDS, docId(this.ownerId, r.collection, r.id));
        batch.set(ref, {
          ownerId: this.ownerId,
          collection: r.collection,
          id: r.id,
          data: r.data,
          updatedAt: r.updatedAt,
          deletedAt: r.deletedAt,
          serverUpdatedAt: serverTimestamp(),
        });
      }
      try {
        await batch.commit();
      } catch (e) {
        mapFirestoreError(e);
      }
    }
  }
}
