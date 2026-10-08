/**
 * RemoteStore backed by Firestore, with sharing.
 *
 * Every row lives in `/records/{ownerUid}_{collection}_{id}` with `ownerId`
 * and `spaceId` (null = private; see services/sharing/spaces.ts). Pull reads
 * my own rows plus the rows of every space I belong to (each query has its
 * own cursor, all packed into the opaque sync cursor). Push stamps each row
 * with its space; rows the rules reject (e.g. no longer allowed to edit) are
 * replaced by the server version instead of blocking the sync forever.
 */
import { collection, doc, firebaseDb, getDocs, limit, orderBy, query, where, writeBatch } from '@/services/backend/firebase';
import { householdOwner, spaceForRecord, type Space } from '@/services/sharing/spaces';
import { getDoc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import type { BaseEntity } from '@/types/entity';
import { SyncError, type PullPage, type PushResult, type RemoteRecord, type RemoteStore } from './types';

const PAGE = 500;
const RECORDS = 'records';

interface RecordDoc {
  ownerId: string;
  collection: string;
  id: string;
  data: BaseEntity;
  updatedAt: string;
  deletedAt: string | null;
  spaceId?: string | null;
  serverUpdatedAt: Timestamp;
}

/** Cursor per query: `own` (my rows) and one per shared space. */
interface Cursors {
  own: string | null;
  spaces: Record<string, string>;
}

function parseCursor(cursor: string | null): Cursors {
  if (!cursor) return { own: null, spaces: {} };
  if (cursor.startsWith('{')) {
    try {
      const c = JSON.parse(cursor) as Partial<Cursors>;
      return { own: c.own ?? null, spaces: c.spaces ?? {} };
    } catch {
      return { own: null, spaces: {} };
    }
  }
  return { own: cursor, spaces: {} }; // single-cursor format (before sharing)
}

const code = (e: unknown) => (e as { code?: string })?.code ?? '';

function mapFirestoreError(e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e);
  if (code(e).includes('unauthenticated') || code(e).includes('permission-denied')) throw new SyncError('unauthorized', msg);
  if (code(e).includes('unavailable') || code(e).includes('deadline-exceeded')) throw new SyncError('offline', msg);
  throw new SyncError('server', msg);
}

const toRemote = (r: RecordDoc): RemoteRecord => ({
  collection: r.collection,
  id: r.id,
  data: r.data,
  updatedAt: r.updatedAt,
  deletedAt: r.deletedAt,
});

export class FirebaseRemoteStore implements RemoteStore {
  readonly id = 'firebase';
  /** 2 = rows carry `spaceId`: the first sync re-uploads everything once. */
  readonly schema = 2;
  private spaces: Space[] = [];
  private spacesAt = 0;

  constructor(
    private readonly me: string,
    /** Owner of a calendar, from the local data (events are stored in their calendar's space). */
    private readonly calendarOwner: (calendarId: string) => Promise<string | null>,
  ) {}

  /** Spaces I belong to (refreshed at most every 30 s). */
  async loadSpaces(force = false): Promise<Space[]> {
    if (!force && Date.now() - this.spacesAt < 30_000) return this.spaces;
    try {
      const snap = await getDocs(query(collection(firebaseDb(), 'spaces'), where('memberIds', 'array-contains', this.me)));
      this.spaces = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Space, 'id'>) }));
      this.spacesAt = Date.now();
    } catch (e) {
      mapFirestoreError(e);
    }
    return this.spaces;
  }

  private async queryPage(field: 'ownerId' | 'spaceId', value: string, since: string | null, overlapMs: number) {
    const constraints = [where(field, '==', value), orderBy('serverUpdatedAt', 'asc'), limit(PAGE)];
    if (since) constraints.splice(1, 0, where('serverUpdatedAt', '>', Timestamp.fromMillis(new Date(since).getTime() - overlapMs)));
    const snap = await getDocs(query(collection(firebaseDb(), RECORDS), ...constraints));
    return snap.docs.map((d) => d.data() as RecordDoc);
  }

  async pull(cursor: string | null, opts: { overlapMs?: number } = {}): Promise<PullPage> {
    const cursors = parseCursor(cursor);
    const overlap = opts.overlapMs ?? 0;
    const spaces = await this.loadSpaces(true);
    // My rows, plus the spaces where other people's rows can be: theirs, or mine with someone else in them.
    const shared = spaces.filter((s) => s.ownerId !== this.me || s.memberIds.length > 1);
    const records: RemoteRecord[] = [];
    let hasMore = false;
    const advance = (docs: RecordDoc[], prev: string | null) => {
      const last = docs[docs.length - 1]?.serverUpdatedAt?.toDate().toISOString();
      if (docs.length === PAGE) hasMore = true;
      records.push(...docs.map(toRemote));
      // Never move a cursor backwards because of the overlap window.
      return last && (!prev || last > prev) ? last : prev;
    };
    const next: Cursors = { own: null, spaces: {} };
    try {
      next.own = advance(await this.queryPage('ownerId', this.me, cursors.own, overlap), cursors.own);
      for (const s of shared) {
        const prev = cursors.spaces[s.id] ?? null;
        const moved = advance(await this.queryPage('spaceId', s.id, prev, overlap), prev);
        if (moved) next.spaces[s.id] = moved;
      }
    } catch (e) {
      mapFirestoreError(e);
    }
    return { records, cursor: JSON.stringify(next), hasMore };
  }

  private async toDoc(r: RemoteRecord, household: string) {
    const ownerId = r.data.ownerId || this.me;
    const spaceId = await spaceForRecord(r.collection, r.data as never, {
      me: this.me,
      household,
      calendarOwner: this.calendarOwner,
    });
    return {
      ref: doc(firebaseDb(), RECORDS, `${ownerId}_${r.collection}_${r.id}`),
      value: {
        ownerId,
        collection: r.collection,
        id: r.id,
        data: { ...r.data, ownerId },
        updatedAt: r.updatedAt,
        deletedAt: r.deletedAt,
        spaceId,
        serverUpdatedAt: serverTimestamp(),
      },
    };
  }

  async push(records: RemoteRecord[]): Promise<PushResult> {
    if (!records.length) return { restored: [] };
    const household = householdOwner(await this.loadSpaces(), this.me);
    const docs = await Promise.all(records.map((r) => this.toDoc(r, household)));
    const restored: RemoteRecord[] = [];
    for (let i = 0; i < docs.length; i += PAGE) {
      const chunk = docs.slice(i, i + PAGE);
      const batch = writeBatch(firebaseDb());
      for (const d of chunk) batch.set(d.ref, d.value);
      try {
        await batch.commit();
      } catch (e) {
        if (!code(e).includes('permission-denied')) mapFirestoreError(e);
        // One row is not allowed: write them one by one and give back the server
        // version of the rejected ones (or remove them if they are not visible).
        for (let j = 0; j < chunk.length; j++) {
          try {
            await setDoc(chunk[j].ref, chunk[j].value);
          } catch (err) {
            if (!code(err).includes('permission-denied')) mapFirestoreError(err);
            const original = records[i + j];
            const server = await getDoc(chunk[j].ref).catch(() => null);
            restored.push(
              server?.exists()
                ? toRemote(server.data() as RecordDoc)
                : { ...original, deletedAt: original.deletedAt ?? new Date().toISOString() },
            );
          }
        }
      }
    }
    return { restored };
  }
}
