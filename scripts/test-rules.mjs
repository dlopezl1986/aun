/**
 * Firestore security rules tests (sharing between AUN accounts).
 * Run against the local emulator:  npm run test:rules
 */
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  setLogLevel,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

setLogLevel('silent'); // denied writes are expected here

const env = await initializeTestEnvironment({
  projectId: 'demo-aun-rules',
  firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
});

let failures = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failures += 1;
    console.log(`  ✗ ${name}\n      ${e?.message ?? e}`);
  }
}

const db = (uid) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const rec = (owner, coll, id, spaceId, extra = {}) => ({
  ownerId: owner,
  collection: coll,
  id,
  data: { id, ownerId: owner, title: id, ...extra },
  updatedAt: '2026-10-08T10:00:00.000Z',
  deletedAt: null,
  spaceId,
  serverUpdatedAt: Timestamp.now(),
});
const recRef = (d, owner, coll, id) => doc(d, 'records', `${owner}_${coll}_${id}`);
const space = (owner, extra = {}) => ({
  ownerId: owner,
  memberIds: [owner],
  roles: {},
  names: { [owner]: owner },
  assignee: null,
  ...extra,
});
const future = () => Timestamp.fromMillis(Date.now() + 7 * 864e5);
const CODE = 'invite-code-0123456789abcdef';

/** Bob claims the invite and joins the given spaces in one batch. */
async function join(d, uid, code, joins) {
  const b = writeBatch(d);
  b.update(doc(d, 'invites', code), { usedBy: uid, usedByName: uid, usedAt: Timestamp.now() });
  for (const [spaceId, role, assign] of joins) {
    b.update(doc(d, 'spaces', spaceId), {
      memberIds: arrayUnion(uid),
      [`roles.${uid}`]: role,
      [`names.${uid}`]: uid,
      joinedWith: code,
      ...(assign ? { assignee: uid } : {}),
    });
  }
  return b.commit();
}

async function seed() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'spaces', 'cal_alice_kids'), space('alice'));
    await setDoc(doc(d, 'spaces', 'cal_alice_sora'), space('alice'));
    await setDoc(doc(d, 'spaces', 'fam_alice'), space('alice'));
    await setDoc(recRef(d, 'alice', 'tasks', 'secret'), rec('alice', 'tasks', 'secret', null));
    await setDoc(recRef(d, 'alice', 'events', 'kidsEvent'), rec('alice', 'events', 'kidsEvent', 'cal_alice_kids'));
    await setDoc(recRef(d, 'alice', 'events', 'soraEvent'), rec('alice', 'events', 'soraEvent', 'cal_alice_sora'));
    await setDoc(recRef(d, 'alice', 'shoppingItems', 'milk'), rec('alice', 'shoppingItems', 'milk', 'fam_alice'));
    await setDoc(doc(d, 'invites', CODE), {
      ownerId: 'alice',
      ownerName: 'Alice',
      grants: { cal_alice_kids: 'view', cal_alice_sora: 'edit', fam_alice: 'edit' },
      assign: 'cal_alice_sora',
      usedBy: null,
      createdAt: Timestamp.now(),
      expiresAt: future(),
    });
  });
}

console.log('Security rules');

await seed();
await test('nobody signed out reads anything', () => assertFails(getDoc(recRef(anon(), 'alice', 'tasks', 'secret'))));
await test('the owner reads and writes their private rows', async () => {
  await assertSucceeds(getDoc(recRef(db('alice'), 'alice', 'tasks', 'secret')));
  await assertSucceeds(setDoc(recRef(db('alice'), 'alice', 'tasks', 'new'), rec('alice', 'tasks', 'new', null)));
});
await test('a stranger cannot read private or shared rows before joining', async () => {
  await assertFails(getDoc(recRef(db('bob'), 'alice', 'tasks', 'secret')));
  await assertFails(getDoc(recRef(db('bob'), 'alice', 'events', 'kidsEvent')));
  await assertFails(getDocs(query(collection(db('bob'), 'records'), where('spaceId', '==', 'cal_alice_kids'))));
});
await test('nobody can create a row in someone else’s name', () =>
  assertFails(setDoc(recRef(db('bob'), 'alice', 'tasks', 'x'), rec('alice', 'tasks', 'x', null))));
await test('nobody can create a space in someone else’s namespace', async () => {
  await assertFails(setDoc(doc(db('bob'), 'spaces', 'fam_alice2'), space('bob')));
  await assertFails(setDoc(doc(db('bob'), 'spaces', 'cal_alice_x'), space('bob')));
  await assertSucceeds(setDoc(doc(db('bob'), 'spaces', 'cal_bob_mine'), space('bob')));
});
await test('the owner can check one of their spaces that does not exist yet, others cannot', async () => {
  await assertSucceeds(getDoc(doc(db('alice'), 'spaces', 'cal_alice_new')));
  await assertFails(getDoc(doc(db('bob'), 'spaces', 'cal_alice_new')));
  await assertFails(getDoc(doc(db('bob'), 'spaces', 'cal_alice_kids')));
});
await test('the invite code can be read by its holder, but invites cannot be listed by others', async () => {
  await assertSucceeds(getDoc(doc(db('bob'), 'invites', CODE)));
  await assertFails(getDocs(query(collection(db('bob'), 'invites'), where('ownerId', '==', 'alice'))));
  await assertSucceeds(getDocs(query(collection(db('alice'), 'invites'), where('ownerId', '==', 'alice'))));
});
await test('joining with a higher role than granted fails', () => assertFails(join(db('bob'), 'bob', CODE, [['cal_alice_kids', 'edit']])));
await test('joining a space the invite does not grant fails', async () => {
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'spaces', 'cal_alice_work'), space('alice')));
  await assertFails(join(db('bob'), 'bob', CODE, [['cal_alice_work', 'view']]));
});
await test('being assigned a calendar the invite does not assign fails', () =>
  assertFails(join(db('bob'), 'bob', CODE, [['cal_alice_kids', 'view', true]])));
await test('the owner cannot "accept" their own invite', () => assertFails(join(db('alice'), 'alice', CODE, [['fam_alice', 'edit']])));
await test('a valid invite joins exactly the granted spaces and roles', () =>
  assertSucceeds(
    join(db('bob'), 'bob', CODE, [
      ['cal_alice_kids', 'view'],
      ['cal_alice_sora', 'edit', true],
      ['fam_alice', 'edit'],
    ]),
  ));
await test('the invite is single use', () => assertFails(join(db('carol'), 'carol', CODE, [['fam_alice', 'edit']])));
await test('after joining, the member reads shared rows (by space) but never private ones', async () => {
  await assertSucceeds(getDocs(query(collection(db('bob'), 'records'), where('spaceId', '==', 'cal_alice_kids'))));
  await assertSucceeds(getDoc(recRef(db('bob'), 'alice', 'shoppingItems', 'milk')));
  await assertFails(getDoc(recRef(db('bob'), 'alice', 'tasks', 'secret')));
  await assertFails(getDocs(query(collection(db('bob'), 'records'), where('ownerId', '==', 'alice'))));
  await assertSucceeds(getDocs(query(collection(db('bob'), 'spaces'), where('memberIds', 'array-contains', 'bob'))));
});
await test('"view" cannot write: no edits and no new events in that calendar', async () => {
  await assertFails(
    setDoc(recRef(db('bob'), 'alice', 'events', 'kidsEvent'), rec('alice', 'events', 'kidsEvent', 'cal_alice_kids', { title: 'hack' })),
  );
  await assertFails(setDoc(recRef(db('bob'), 'bob', 'events', 'b1'), rec('bob', 'events', 'b1', 'cal_alice_kids')));
});
await test('"edit" can edit and add events (but not take ownership or move them out)', async () => {
  await assertSucceeds(
    setDoc(recRef(db('bob'), 'alice', 'events', 'soraEvent'), rec('alice', 'events', 'soraEvent', 'cal_alice_sora', { title: 'edited' })),
  );
  await assertSucceeds(setDoc(recRef(db('bob'), 'bob', 'events', 'b2'), rec('bob', 'events', 'b2', 'cal_alice_sora')));
  await assertFails(setDoc(recRef(db('bob'), 'alice', 'events', 'soraEvent'), rec('bob', 'events', 'soraEvent', 'cal_alice_sora')));
  await assertFails(setDoc(recRef(db('bob'), 'alice', 'events', 'soraEvent'), rec('alice', 'events', 'soraEvent', null)));
  await assertFails(setDoc(recRef(db('bob'), 'alice', 'events', 'soraEvent'), rec('alice', 'events', 'soraEvent', 'cal_alice_kids')));
});
await test('the family space is shared (edit) both ways', async () => {
  await assertSucceeds(
    setDoc(recRef(db('bob'), 'alice', 'shoppingItems', 'milk'), rec('alice', 'shoppingItems', 'milk', 'fam_alice', { done: true })),
  );
  await assertSucceeds(setDoc(recRef(db('bob'), 'bob', 'shoppingItems', 'bread'), rec('bob', 'shoppingItems', 'bread', 'fam_alice')));
  await assertSucceeds(getDoc(recRef(db('alice'), 'bob', 'shoppingItems', 'bread')));
  await assertSucceeds(getDocs(query(collection(db('alice'), 'records'), where('spaceId', '==', 'fam_alice'))));
});
await test('a member cannot change roles or add other people', async () => {
  await assertFails(updateDoc(doc(db('bob'), 'spaces', 'cal_alice_kids'), { 'roles.bob': 'edit' }));
  await assertFails(updateDoc(doc(db('bob'), 'spaces', 'fam_alice'), { memberIds: arrayUnion('carol'), 'roles.carol': 'edit' }));
});
await test('the owner can remove a member, who then loses access', async () => {
  await assertSucceeds(
    updateDoc(doc(db('alice'), 'spaces', 'cal_alice_kids'), { memberIds: ['alice'], roles: {}, names: { alice: 'alice' } }),
  );
  await assertFails(getDoc(recRef(db('bob'), 'alice', 'events', 'kidsEvent')));
});
await test('an expired invite cannot be used', async () => {
  await env.withSecurityRulesDisabled((ctx) =>
    setDoc(doc(ctx.firestore(), 'invites', 'expired-code-0123456789ab'), {
      ownerId: 'alice',
      grants: { cal_alice_kids: 'view' },
      usedBy: null,
      expiresAt: Timestamp.fromMillis(Date.now() - 1000),
    }),
  );
  await assertFails(join(db('carol'), 'carol', 'expired-code-0123456789ab', [['cal_alice_kids', 'view']]));
});

console.log('Notices outside the app');
await test('my notice settings are mine: nobody else reads or writes them', async () => {
  await assertSucceeds(setDoc(doc(db('alice'), 'notify', 'alice'), { email: null, emailDaily: true }));
  await assertFails(getDoc(doc(db('bob'), 'notify', 'alice')));
  await assertFails(setDoc(doc(db('bob'), 'notify', 'alice'), { email: null }));
});
await test('the summary e-mail can only be my own account e-mail', async () => {
  const alice = env.authenticatedContext('alice', { email: 'alice@x.com' }).firestore();
  await assertSucceeds(setDoc(doc(alice, 'notify', 'alice'), { email: 'alice@x.com', emailDaily: true }));
  await assertFails(setDoc(doc(alice, 'notify', 'alice'), { email: 'victim@x.com', emailDaily: true }));
});
await test('the Telegram chat cannot be set from the app (only the bot), but can be kept or cleared', async () => {
  await assertFails(setDoc(doc(db('alice'), 'notify', 'alice'), { telegramChatId: '12345' }));
  await env.withSecurityRulesDisabled((ctx) =>
    setDoc(doc(ctx.firestore(), 'notify', 'alice'), { telegramChatId: '999', telegramName: 'Ali' }),
  );
  await assertSucceeds(setDoc(doc(db('alice'), 'notify', 'alice'), { telegramChatId: '999', telegramName: 'Ali', telegramDaily: true }));
  await assertFails(setDoc(doc(db('alice'), 'notify', 'alice'), { telegramChatId: '12345', telegramName: 'Ali' }));
  await assertSucceeds(setDoc(doc(db('alice'), 'notify', 'alice'), { telegramChatId: null, telegramName: null }));
});
await test('alerts and summaries to send are private to their owner', async () => {
  await assertSucceeds(setDoc(doc(db('alice'), 'outbox', 'alice_abc'), { uid: 'alice', title: 'Dentista', sent: false }));
  await assertFails(setDoc(doc(db('bob'), 'outbox', 'alice_x'), { uid: 'bob', title: 'spam', sent: false }));
  await assertFails(setDoc(doc(db('bob'), 'outbox', 'bob_x'), { uid: 'alice', title: 'spam', sent: false }));
  await assertFails(getDoc(doc(db('bob'), 'outbox', 'alice_abc')));
  await assertSucceeds(getDocs(query(collection(db('alice'), 'outbox'), where('uid', '==', 'alice'))));
  await assertSucceeds(setDoc(doc(db('alice'), 'digests', 'alice_2026-10-09'), { uid: 'alice', title: 'Hoy' }));
  await assertFails(getDoc(doc(db('bob'), 'digests', 'alice_2026-10-09')));
});

await env.cleanup();
if (failures) {
  console.log(`\n${failures} rule test(s) FAILED`);
  process.exit(1);
}
console.log('\nAll rule tests passed');
