/**
 * The spaces I can see: the ones I am a member of, plus the calendars other
 * family members share with my family. Used by sync (what to download and
 * listen to) and by the sharing screens.
 */
import { collection, getDocsFromServer, onSnapshot, query, where, type Firestore, type Unsubscribe } from 'firebase/firestore';

import type { Space } from './spaces';

const trace = (event: string, detail?: unknown) => {
  if (!__DEV__) return;
  const g = globalThis as { __aunSync?: unknown[] };
  (g.__aunSync ??= []).push({ t: new Date().toISOString().slice(11, 23), event, detail });
};

const toSpaces = (docs: { id: string; data: () => unknown }[]): Space[] =>
  docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Space, 'id'>) }));

const familiesOf = (spaces: Space[], me: string) =>
  spaces.filter((s) => s.id.startsWith('fam_') && s.memberIds.includes(me)).map((s) => s.id);

function merge(lists: Space[][]): Space[] {
  const byId = new Map<string, Space>();
  for (const list of lists) for (const s of list) byId.set(s.id, s);
  return [...byId.values()];
}

export async function fetchSpaces(db: Firestore, me: string): Promise<Space[]> {
  const mine = toSpaces((await getDocsFromServer(query(collection(db, 'spaces'), where('memberIds', 'array-contains', me)))).docs);
  const shared = await Promise.all(
    familiesOf(mine, me).map(async (f) =>
      toSpaces((await getDocsFromServer(query(collection(db, 'spaces'), where('family', '==', f)))).docs),
    ),
  );
  return merge([mine, ...shared]);
}

/**
 * Live version of fetchSpaces: calls `onChange` with the full list whenever any
 * of it changes (server-confirmed, never a stale cached copy). `onRevoked`
 * fires when access was taken away under a listener: Firestore then errors that
 * listener AND stalls the others on the same connection, so the caller must
 * close everything and listen again.
 */
export function watchSpaces(db: Firestore, me: string, onChange: (spaces: Space[]) => void, onRevoked: () => void): Unsubscribe {
  let mine: Space[] = [];
  const byFamily = new Map<string, { stop: Unsubscribe; spaces: Space[] }>();
  let ready = false;
  const emit = () => ready && onChange(merge([mine, ...[...byFamily.values()].map((f) => f.spaces)]));
  const fail = (where: string, e: unknown) => {
    trace('spaces:error', { where, e: String(e) });
    if ((e as { code?: string })?.code === 'permission-denied') onRevoked();
  };
  const stopMine = onSnapshot(
    query(collection(db, 'spaces'), where('memberIds', 'array-contains', me)),
    { includeMetadataChanges: true },
    (snap) => {
      if (snap.metadata.fromCache) return; // wait for the server's answer
      mine = toSpaces(snap.docs);
      trace(
        'spaces:mine',
        mine.map((x) => x.id),
      );
      const families = new Set(familiesOf(mine, me));
      for (const [f, l] of byFamily) {
        if (families.has(f)) continue;
        l.stop();
        byFamily.delete(f);
      }
      for (const f of families) {
        if (byFamily.has(f)) continue;
        const entry: { stop: Unsubscribe; spaces: Space[] } = { stop: () => undefined, spaces: [] };
        byFamily.set(f, entry);
        entry.stop = onSnapshot(
          query(collection(db, 'spaces'), where('family', '==', f)),
          { includeMetadataChanges: true },
          (s) => {
            if (s.metadata.fromCache) return;
            entry.spaces = toSpaces(s.docs);
            trace('spaces:family', { f, ids: entry.spaces.map((x) => x.id) });
            emit();
          },
          (e) => fail(`family ${f}`, e),
        );
      }
      ready = true;
      emit();
    },
    (e) => fail('mine', e),
  );
  return () => {
    stopMine();
    for (const l of byFamily.values()) l.stop();
  };
}
