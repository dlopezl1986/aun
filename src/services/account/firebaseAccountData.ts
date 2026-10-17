/**
 * Server side of "Eliminar mi cuenta" (Firebase). Runs signed in, before the
 * Auth user is deleted, and every step is allowed by firestore.rules:
 *  - every row I own is deleted for real; the ones inside someone else's
 *    family or calendar become an empty tombstone (id only, no content) so
 *    their devices drop them too,
 *  - my spaces are deleted and I leave the ones other people share with me,
 *  - my invitations and my e-mail / Telegram notice documents go too.
 * Rows other people keep in my former spaces stay theirs.
 */
import {
  collection,
  documentId,
  orderBy,
  serverTimestamp,
  startAfter,
  type DocumentSnapshot,
  type QuerySnapshot,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  limit,
  query,
  updateDoc,
  where,
  writeBatch,
  type Query,
} from 'firebase/firestore';

import { firebaseDb } from '@/services/backend/firebase';

const BATCH = 400;

/** Deletes everything a query returns, page by page. Returns how many. */
async function deleteAll(q: (n: number) => Query): Promise<number> {
  const db = firebaseDb();
  let total = 0;
  for (;;) {
    const snap = await getDocs(q(BATCH));
    if (snap.empty) return total;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
    if (snap.size < BATCH) return total;
  }
}

/** My rows: deleted, or emptied into a tombstone when they live in someone else's space. */
async function removeMyRows(uid: string): Promise<number> {
  const db = firebaseDb();
  const mySpace = (s: string) => s === `fam_${uid}` || s.startsWith(`cal_${uid}_`);
  const now = new Date().toISOString();
  let last: DocumentSnapshot | null = null;
  let total = 0;
  for (;;) {
    const constraints = [where('ownerId', '==', uid), orderBy(documentId()), limit(BATCH)];
    const snap: QuerySnapshot = await getDocs(query(collection(db, 'records'), ...constraints, ...(last ? [startAfter(last)] : [])));
    if (snap.empty) return total;
    const batch = writeBatch(db);
    for (const d of snap.docs) {
      const r = d.data() as { collection: string; id: string; updatedAt: string; spaceId?: string | null };
      if (!r.spaceId || mySpace(r.spaceId)) batch.delete(d.ref);
      else
        batch.set(d.ref, {
          ownerId: uid,
          collection: r.collection,
          id: r.id,
          data: { id: r.id, ownerId: uid },
          updatedAt: r.updatedAt > now ? r.updatedAt : now,
          deletedAt: now,
          spaceId: r.spaceId,
          serverUpdatedAt: serverTimestamp(),
        });
    }
    await batch.commit();
    total += snap.size;
    if (snap.size < BATCH) return total;
    last = snap.docs[snap.docs.length - 1];
  }
}

export async function deleteFirebaseAccountData(uid: string): Promise<{ rows: number }> {
  const db = firebaseDb();
  const rows = await removeMyRows(uid);

  const spaces = await getDocs(query(collection(db, 'spaces'), where('memberIds', 'array-contains', uid)));
  for (const s of spaces.docs) {
    const data = s.data() as { ownerId: string; memberIds: string[]; assignee?: string | null };
    if (data.ownerId === uid) {
      await deleteDoc(s.ref);
      continue;
    }
    await updateDoc(s.ref, {
      memberIds: data.memberIds.filter((m) => m !== uid),
      [`roles.${uid}`]: deleteField(),
      [`names.${uid}`]: deleteField(),
      ...(data.assignee === uid ? { assignee: null } : {}),
    });
  }

  await deleteAll((n) => query(collection(db, 'invites'), where('ownerId', '==', uid), limit(n)));
  await deleteAll((n) => query(collection(db, 'outbox'), where('uid', '==', uid), limit(n)));
  await deleteAll((n) => query(collection(db, 'digests'), where('uid', '==', uid), limit(n)));
  await deleteDoc(doc(db, 'notify', uid));
  return { rows };
}
