/**
 * RemoteStore backed by Firestore, with sharing.
 *
 * Every row lives in `/records/{ownerUid}_{collection}_{id}` with `ownerId`
 * and `spaceId` (null = private; see services/sharing/spaces.ts). Pull reads
 * my own rows plus the rows of every space I belong to (each query has its
 * own cursor, all packed into the opaque sync cursor). Push stamps each row
 * with its space; rows the rules reject (e.g. no longer allowed to edit) are
 * replaced by the server version instead of blocking the sync forever.
 *
 * `watch` keeps live listeners on the same queries (only changes after it
 * starts), so a change made by the family shows up in seconds.
 */
import { collection, doc, firebaseDb, getDocsFromServer, limit, orderBy, query, where, writeBatch } from '@/services/backend/firebase';
import { familySpaceId, householdOwner, spaceForRecord, type Space } from '@/services/sharing/spaces';
import { getDocFromServer, onSnapshot, serverTimestamp, setDoc, Timestamp, type Unsubscribe } from 'firebase/firestore';
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
  // `space` is local-only (where the row is shared); the engine strips it before pushing.
  data: { ...r.data, space: r.spaceId ?? null },
  updatedAt: r.updatedAt,
  deletedAt: r.deletedAt,
});

export class FirebaseRemoteStore implements RemoteStore {
  readonly id = 'firebase';
  /** 2 = rows carry `spaceId`: the first sync re-uploads everything once. */
  readonly schema = 2;
  /** 1 = pulled rows carry their space: the first sync downloads everything once. */
  readonly pullSchema = 1;
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
      const snap = await getDocsFromServer(query(collection(firebaseDb(), 'spaces'), where('memberIds', 'array-contains', this.me)));
      this.spaces = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Space, 'id'>) }));
      this.spacesAt = Date.now();
    } catch (e) {
      mapFirestoreError(e);
    }
    return this.spaces;
  }

  /**
   * Spaces whose rows can come from other people. A space only exists once
   * something was shared, so all of them: even with nobody else in it now,
   * people who left can still update (or delete) the rows they added.
   */
  private sharedSpaces(spaces: Space[]): Space[] {
    return spaces;
  }

  /** Whose family my family rows belong to. */
  async layout(): Promise<string> {
    return householdOwner(await this.loadSpaces(), this.me);
  }

  /** Someone else's row in a space I am not in any more (call after a pull: spaces are fresh). */
  isGone(_collection: string, row: BaseEntity): boolean {
    if (row.space === undefined) return false; // not known yet
    if (row.space === null) return true; // private to its owner
    if (row.space === familySpaceId(this.me) || row.space.startsWith(`cal_${this.me}_`)) return false;
    return !this.spaces.some((s) => s.id === row.space && s.memberIds.includes(this.me));
  }

  watch(handlers: { onRecords: (records: RemoteRecord[]) => void; onAccess: () => void }): () => void {
    const db = firebaseDb();
    let records: Unsubscribe[] = [];
    let accessKey: string | null = null;
    const stopRecords = () => {
      records.forEach((u) => u());
      records = [];
    };
    const listen = (field: 'ownerId' | 'spaceId', value: string, since: Timestamp) =>
      onSnapshot(
        query(collection(db, RECORDS), where(field, '==', value), where('serverUpdatedAt', '>', since)),
        (snap) => {
          // Our own writes come back once the server stamps them; merging them again is harmless.
          const changed = snap
            .docChanges()
            .filter((c) => c.type !== 'removed' && !c.doc.metadata.hasPendingWrites)
            .map((c) => toRemote(c.doc.data() as RecordDoc));
          if (changed.length) handlers.onRecords(changed);
        },
        () => undefined, // e.g. offline or access just removed: the next sync sorts it out
      );
    const spaces = onSnapshot(
      query(collection(db, 'spaces'), where('memberIds', 'array-contains', this.me)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Space, 'id'>) }));
        const shared = this.sharedSpaces(list);
        const key = JSON.stringify(shared.map((s) => [s.id, s.roles[this.me] ?? 'owner', s.memberIds.length]).sort());
        if (key === accessKey) return;
        const first = accessKey === null;
        accessKey = key;
        this.spaces = list;
        this.spacesAt = Date.now();
        // (Re)start the row listeners from now; anything before is covered by the sync below.
        stopRecords();
        const since = Timestamp.now();
        records = [listen('ownerId', this.me, since), ...shared.map((s) => listen('spaceId', s.id, since))];
        if (!first) handlers.onAccess();
      },
      () => undefined,
    );
    return () => {
      spaces();
      stopRecords();
    };
  }

  private async queryPage(field: 'ownerId' | 'spaceId', value: string, since: string | null, overlapMs: number) {
    const constraints = [where(field, '==', value), orderBy('serverUpdatedAt', 'asc'), limit(PAGE)];
    if (since) constraints.splice(1, 0, where('serverUpdatedAt', '>', Timestamp.fromMillis(new Date(since).getTime() - overlapMs)));
    const snap = await getDocsFromServer(query(collection(firebaseDb(), RECORDS), ...constraints));
    return snap.docs.map((d) => d.data() as RecordDoc);
  }

  async pull(cursor: string | null, opts: { overlapMs?: number } = {}): Promise<PullPage> {
    const cursors = parseCursor(cursor);
    const overlap = opts.overlapMs ?? 0;
    const spaces = await this.loadSpaces(true);
    const shared = this.sharedSpaces(spaces);
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
            const server = await getDocFromServer(chunk[j].ref).catch(() => null);
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
