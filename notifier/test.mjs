/**
 * Integration test of the notifier against the Firestore emulator, a fake
 * Telegram API and an in-memory mailer.  Run: npm run test:notifier
 */
import http from 'node:http';
import assert from 'node:assert/strict';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { createNotifier, localNow } from './run.mjs';

const db = getFirestore(initializeApp({ projectId: 'demo-aun-notifier' }, 'notifier-test'));

// --- fake Telegram ---------------------------------------------------------
let updates = [];
const sent = [];
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const payload = body ? JSON.parse(body) : {};
    const method = req.url.split('/').pop();
    let result = true;
    if (method === 'getUpdates') result = updates.filter((u) => u.update_id >= (payload.offset ?? 0));
    if (method === 'sendMessage') sent.push({ chat: String(payload.chat_id), text: payload.text });
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, result }));
  });
});
await new Promise((r) => server.listen(0, r));
const telegramApi = `http://127.0.0.1:${server.address().port}`;

// --- in-memory mailer --------------------------------------------------------
const mails = [];
const mailer = { sendMail: async (m) => void mails.push(m) };

let clock = new Date('2026-10-09T06:00:00Z'); // 08:00 in Madrid
const make = () =>
  createNotifier({ db, telegramToken: 'TEST', telegramApi, mailer, mailFrom: 'AUN <aun@test>', now: () => clock, log: () => {} });

let failures = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failures += 1;
    console.log(`  ✗ ${name}\n      ${e.message}`);
  }
}

async function clear() {
  for (const c of ['notify', 'outbox', 'digests', 'system']) {
    const snap = await db.collection(c).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
  updates = [];
  sent.length = 0;
  mails.length = 0;
}

console.log('Notifier');
await clear();

await test('local time follows each person’s time zone', () => {
  assert.deepEqual(localNow('Europe/Madrid', new Date('2026-10-09T06:00:00Z')), { date: '2026-10-09', time: '08:00' });
  assert.deepEqual(localNow('America/Mexico_City', new Date('2026-10-09T03:30:00Z')), { date: '2026-10-08', time: '21:30' });
});

await test('"/start <code>" links the Telegram chat to the right account (once)', async () => {
  await db.collection('notify').doc('u1').set({ telegramLinkCode: 'code-abc', lang: 'es' });
  updates = [
    { update_id: 10, message: { text: '/start code-abc', chat: { id: 111, first_name: 'Soraya' } } },
    { update_id: 11, message: { text: '/start wrong', chat: { id: 222, first_name: 'Intruso' } } },
  ];
  await make().linkTelegram();
  const n = (await db.collection('notify').doc('u1').get()).data();
  assert.equal(n.telegramChatId, '111');
  assert.equal(n.telegramName, 'Soraya');
  assert.equal(n.telegramLinkCode, null);
  assert.match(sent.find((m) => m.chat === '111').text, /conectado/);
  assert.match(sent.find((m) => m.chat === '222').text, /Conectar Telegram/);
  sent.length = 0;
  await make().linkTelegram(); // same updates again: already processed (offset)
  assert.equal(sent.length, 0);
});

await test('alerts are sent when due, once; future ones wait and stale ones are dropped', async () => {
  await db.collection('notify').doc('u1').set({ telegramChatId: '111', telegramAlerts: true, lang: 'es' }, { merge: true });
  await db.collection('notify').doc('u2').set({ telegramChatId: null, lang: 'es' });
  const at = (ms) => Timestamp.fromMillis(clock.getTime() + ms);
  await db
    .collection('outbox')
    .doc('u1_due')
    .set({ uid: 'u1', at: at(2 * 60_000), title: 'Natación Elisa', body: '17:30 · Elisa', sent: false });
  await db
    .collection('outbox')
    .doc('u1_later')
    .set({ uid: 'u1', at: at(60 * 60_000), title: 'Dentista', body: '', sent: false });
  await db
    .collection('outbox')
    .doc('u1_stale')
    .set({ uid: 'u1', at: at(-3 * 3_600_000), title: 'Viejo', body: '', sent: false });
  await db
    .collection('outbox')
    .doc('u2_due')
    .set({ uid: 'u2', at: at(0), title: 'Sin Telegram', body: '', sent: false });
  await make().sendAlerts();
  assert.deepEqual(
    sent.map((m) => m.text),
    ['🔔 Natación Elisa\n17:30 · Elisa'],
  );
  assert.equal((await db.collection('outbox').doc('u1_later').get()).data().sent, false);
  assert.equal((await db.collection('outbox').doc('u1_stale').get()).data().sent, true);
  assert.equal((await db.collection('outbox').doc('u2_due').get()).data().skipped, true);
  await make().sendAlerts();
  assert.equal(sent.length, 1, 'no duplicates');
  clock = new Date(clock.getTime() + 58 * 60_000);
  await make().sendAlerts();
  assert.deepEqual(sent.map((m) => m.text).slice(-1), ['🔔 Dentista']);
  clock = new Date('2026-10-09T06:00:00Z');
});

await test('the daily summary goes by e-mail and Telegram at the chosen local time, once a day', async () => {
  await db.collection('notify').doc('u1').set(
    {
      email: 'soraya@test.aun',
      emailDaily: true,
      emailTime: '07:30',
      telegramDaily: true,
      telegramTime: '09:00',
      timeZone: 'Europe/Madrid',
      lang: 'es',
    },
    { merge: true },
  );
  await db
    .collection('digests')
    .doc('u1_2026-10-09')
    .set({
      uid: 'u1',
      date: '2026-10-09',
      title: 'Viernes, 9 de octubre',
      sections: [{ icon: '📅', heading: 'Eventos', lines: ['17:30 · Natación — Elisa'] }],
      emptyText: 'Nada',
    });
  sent.length = 0;
  await make().sendDigests(); // 08:00 Madrid: e-mail (07:30) yes, Telegram (09:00) not yet
  assert.equal(mails.length, 1);
  assert.equal(mails[0].to, 'soraya@test.aun');
  assert.match(mails[0].subject, /Viernes, 9 de octubre/);
  assert.match(mails[0].text, /Natación — Elisa/);
  assert.match(mails[0].html, /Natación — Elisa/);
  assert.equal(sent.length, 0);
  clock = new Date('2026-10-09T07:05:00Z'); // 09:05 Madrid
  await make().sendDigests();
  assert.equal(mails.length, 1, 'e-mail only once a day');
  assert.equal(sent.length, 1);
  assert.match(sent[0].text, /Tu día — Viernes, 9 de octubre/);
  await make().sendDigests();
  assert.equal(sent.length, 1, 'Telegram only once a day');
  clock = new Date('2026-10-09T06:00:00Z');
});

await test('a summary many hours late is skipped (no 11 pm "good morning"), but a new time the same day works', async () => {
  await db
    .collection('notify')
    .doc('u3')
    .set({ email: 'late@test.aun', emailDaily: true, emailTime: '07:30', timeZone: 'Europe/Madrid', lang: 'es' });
  await db.collection('digests').doc('u3_2026-10-09').set({ uid: 'u3', date: '2026-10-09', title: 'Hoy', sections: [], emptyText: 'Nada' });
  mails.length = 0;
  clock = new Date('2026-10-09T19:00:00Z'); // 21:00 Madrid
  await make().sendDigests();
  assert.equal(mails.filter((m) => m.to === 'late@test.aun').length, 0);
  // …and changing the time to later today still sends it.
  await db.collection('notify').doc('u3').update({ emailTime: '20:45' });
  await make().sendDigests();
  assert.equal(mails.filter((m) => m.to === 'late@test.aun').length, 1);
  clock = new Date('2026-10-09T06:00:00Z');
});

await test('sent alerts older than 2 days are cleaned up', async () => {
  await db
    .collection('outbox')
    .doc('u1_old')
    .set({ uid: 'u1', at: Timestamp.fromMillis(clock.getTime() - 3 * 86_400_000), title: 'x', sent: true });
  const removed = await make().cleanup();
  assert.ok(removed >= 1);
  assert.equal((await db.collection('outbox').doc('u1_old').get()).exists, false);
});

server.close();
if (failures) {
  console.log(`\n${failures} notifier test(s) FAILED`);
  process.exit(1);
}
console.log('\nAll notifier tests passed');
process.exit(0);
