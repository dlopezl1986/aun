/**
 * Read-only diagnosis of family sharing (GitHub Actions, manual run).
 * Prints ONLY structure and counts — people as A, B…, ids as short hashes,
 * no titles or content — because Actions logs of a public repo are public.
 */
import { createHash } from 'node:crypto';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore(app);
const h = (s) => createHash('sha256').update(String(s)).digest('hex').slice(0, 6);

const labels = new Map();
const who = (uid) => {
  if (!uid) return '-';
  if (!labels.has(uid)) labels.set(uid, String.fromCharCode(65 + labels.size));
  return labels.get(uid);
};
const spaceLabel = (s) =>
  s ? s.replace(/^(fam|cal)_([^_]+)(_(.*))?$/, (_, k, o, __, c) => `${k}_${who(o)}${c ? '_' + h(c) : ''}`) : 'private';
const ago = (ts) => (ts ? `${Math.round((Date.now() - ts.toMillis()) / 60000)} min` : '?');

const users = (await getAuth(app).listUsers(100)).users;
console.log('== Accounts');
for (const u of users)
  console.log(
    `${who(u.uid)}  verified=${u.emailVerified}  lastSignIn=${u.metadata.lastSignInTime ?? '-'}  lastRefresh=${u.metadata.lastRefreshTime ?? '-'}`,
  );

console.log('\n== Spaces');
for (const d of (await db.collection('spaces').get()).docs) {
  const s = d.data();
  const members = (s.memberIds ?? []).map((m) => `${who(m)}:${m === s.ownerId ? 'owner' : (s.roles?.[m] ?? 'NO-ROLE')}`);
  console.log(`${spaceLabel(d.id)}  members=[${members.join(', ')}]  assignee=${who(s.assignee)}`);
}

console.log('\n== Family/shopping records (owner · collection · space → live / deleted, newest change)');
const fam = ['shoppingLists', 'shoppingItems', 'shoppingCategories', 'familyMembers', 'children', 'familyItems'];
const groups = new Map();
const lists = new Map();
const items = [];
for (const c of fam) {
  for (const d of (await db.collection('records').where('collection', '==', c).get()).docs) {
    const r = d.data();
    const k = `${who(r.ownerId)} · ${c} · ${spaceLabel(r.spaceId)}`;
    const g = groups.get(k) ?? { live: 0, deleted: 0, newest: null };
    r.deletedAt ? g.deleted++ : g.live++;
    if (!g.newest || r.serverUpdatedAt?.toMillis() > g.newest.toMillis()) g.newest = r.serverUpdatedAt;
    groups.set(k, g);
    if (c === 'shoppingLists') lists.set(r.id, r);
    if (c === 'shoppingItems') items.push(r);
  }
}
for (const [k, g] of [...groups].sort()) console.log(`${k} → ${g.live} / ${g.deleted}  (last ${ago(g.newest)} ago)`);

console.log('\n== Shopping lists (items by state: open / done / archived / deleted)');
for (const [id, l] of lists) {
  const mine = items.filter((i) => i.data?.listId === id);
  const n = (f) => mine.filter(f).length;
  console.log(
    `list ${h(id)} owner=${who(l.ownerId)} space=${spaceLabel(l.spaceId)} auto=${!!l.data?.auto} deleted=${!!l.deletedAt} created=${l.data?.createdAt?.slice(0, 16)}` +
      `  items: ${n((i) => !i.deletedAt && !i.data?.done && !i.data?.archivedAt)} / ${n((i) => !i.deletedAt && i.data?.done && !i.data?.archivedAt)} / ${n((i) => !i.deletedAt && i.data?.archivedAt)} / ${n((i) => i.deletedAt)}` +
      `  by=[${[...new Set(mine.map((i) => who(i.ownerId)))].join(',')}]`,
  );
}
const orphans = items.filter((i) => !i.deletedAt && !lists.has(i.data?.listId));
const onDeleted = items.filter((i) => !i.deletedAt && lists.get(i.data?.listId)?.deletedAt);
console.log(`\nLive items whose list does not exist: ${orphans.length}; whose list is deleted: ${onDeleted.length}`);
const spaceMismatch = items.filter((i) => !i.deletedAt && lists.has(i.data?.listId) && lists.get(i.data.listId).spaceId !== i.spaceId);
console.log(`Live items in a different space than their list: ${spaceMismatch.length}`);
process.exit(0);
