/**
 * AUN notifier: sends notices outside the app.
 *
 *   1. Telegram linking: "/start <code>" sent to the bot links that chat to
 *      the account whose notify/{uid}.telegramLinkCode matches ("/stop" unlinks).
 *   2. Alerts: outbox docs due now (or within LEAD) go to the user's Telegram.
 *   3. Daily summary: at each user's chosen local time, digests/{uid}_{date}
 *      goes by e-mail and/or Telegram.
 *
 * The app publishes notify / outbox / digests (src/services/remoteNotify).
 * Runs every 5 minutes on GitHub Actions (.github/workflows/notifier.yml).
 *
 * Environment:
 *   FIREBASE_SERVICE_ACCOUNT  service-account JSON (or FIRESTORE_EMULATOR_HOST for tests)
 *   TELEGRAM_BOT_TOKEN        from @BotFather (optional: no Telegram without it)
 *   GMAIL_USER, GMAIL_APP_PASSWORD   Gmail account + app password (optional: no e-mail without them)
 *   TELEGRAM_API, EMAIL_TRANSPORT=json   test overrides
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';

/** Alerts are sent up to this much early (the job runs every ~5 min, sometimes later). */
const LEAD_MS = 5 * 60_000;
/** Alerts older than this are dropped instead of sent late. */
const STALE_MS = 2 * 3_600_000;
/** A daily summary more than this late is skipped for the day (job was down). */
const DAILY_LATE_MS = 3 * 3_600_000;
const KEEP_SENT_MS = 2 * 86_400_000;

const MSG = {
  es: {
    linked: (name) => `✅ ¡Hola ${name}! AUN está conectado. Te avisaré aquí de tus eventos, notas y tareas.`,
    unknown: 'Para conectar, abre AUN → Configuración → Notificaciones → «Conectar Telegram».',
    stopped: '👋 Desconectado. No recibirás más avisos de AUN aquí.',
    summary: 'Tu día',
    subject: (title) => `AUN · ${title}`,
    footer: 'Este resumen lo envía AUN. Puedes desactivarlo en Configuración → Notificaciones.',
  },
  en: {
    linked: (name) => `✅ Hi ${name}! AUN is connected. I will send your events, notes and tasks here.`,
    unknown: 'To connect, open AUN → Settings → Notifications → “Connect Telegram”.',
    stopped: '👋 Disconnected. You will not get AUN notices here any more.',
    summary: 'Your day',
    subject: (title) => `AUN · ${title}`,
    footer: 'This summary is sent by AUN. You can turn it off in Settings → Notifications.',
  },
};
const msg = (lang) => MSG[(lang || 'es').slice(0, 2)] ?? MSG.es;

/** Local date and HH:MM of `now` in a time zone. */
export function localNow(timeZone, now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

const minutes = (hhmm) => {
  const [h, m] = String(hhmm || '00:00')
    .split(':')
    .map(Number);
  return h * 60 + m;
};

/** Digest → plain text (Telegram, e-mail text part). */
export function digestText(d, heading) {
  const lines = [`${heading} — ${d.title}`];
  if (!d.sections?.length) lines.push('', d.emptyText);
  for (const s of d.sections ?? []) lines.push('', `${s.icon} ${s.heading}`, ...s.lines.map((l) => `• ${l}`));
  return lines.join('\n');
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function digestHtml(d, heading, footer) {
  const sections = (d.sections ?? [])
    .map(
      (s) =>
        `<h3 style="margin:20px 0 6px;font-size:16px">${esc(s.icon)} ${esc(s.heading)}</h3><ul style="margin:0;padding-left:20px">${s.lines
          .map((l) => `<li style="margin:3px 0">${esc(l)}</li>`)
          .join('')}</ul>`,
    )
    .join('');
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:auto;color:#1f2937">
<div style="background:#131C2E;color:#fff;padding:18px 22px;border-radius:14px 14px 0 0"><div style="font-size:13px;opacity:.75">AUN · ${esc(heading)}</div><div style="font-size:22px;font-weight:700">${esc(d.title)}</div></div>
<div style="background:#FBF8F1;padding:6px 22px 22px;border-radius:0 0 14px 14px">${sections || `<p style="margin-top:16px">${esc(d.emptyText)}</p>`}</div>
<p style="font-size:12px;color:#6b7280;text-align:center">${esc(footer)}</p></div>`;
}

export function createNotifier({
  db,
  telegramToken,
  telegramApi = 'https://api.telegram.org',
  mailer,
  mailFrom,
  now = () => new Date(),
  log = console.log,
}) {
  const tgBase = telegramToken ? `${telegramApi}/bot${telegramToken}` : null;

  async function tg(method, body) {
    const res = await fetch(`${tgBase}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(`Telegram ${method}: ${json.description ?? res.status}`);
    return json.result;
  }
  const say = (chatId, text) => tg('sendMessage', { chat_id: chatId, text, disable_web_page_preview: true });

  /** 1. "/start <code>" links a chat, "/stop" unlinks it. */
  async function linkTelegram() {
    if (!tgBase) return 0;
    const stateRef = db.collection('system').doc('notifier');
    const offset = (await stateRef.get()).data()?.telegramOffset ?? 0;
    const updates = await tg('getUpdates', { offset, timeout: 0, allowed_updates: ['message'] });
    let linked = 0;
    for (const u of updates) {
      const m = u.message;
      if (!m?.text || !m.chat) continue;
      const [cmd, code] = m.text.trim().split(/\s+/);
      const name = m.chat.first_name || m.chat.username || 'Telegram';
      if (cmd === '/start' && code) {
        const found = await db.collection('notify').where('telegramLinkCode', '==', code).limit(1).get();
        if (found.empty) {
          await say(m.chat.id, msg().unknown);
          continue;
        }
        const ref = found.docs[0].ref;
        await ref.update({ telegramChatId: String(m.chat.id), telegramName: name, telegramLinkCode: null });
        await say(m.chat.id, msg(found.docs[0].data().lang).linked(name));
        linked += 1;
      } else if (cmd === '/stop') {
        const found = await db.collection('notify').where('telegramChatId', '==', String(m.chat.id)).get();
        for (const d of found.docs) await d.ref.update({ telegramChatId: null, telegramName: null });
        await say(m.chat.id, msg(found.docs[0]?.data().lang).stopped);
      } else {
        await say(m.chat.id, msg().unknown);
      }
    }
    if (updates.length) await stateRef.set({ telegramOffset: updates[updates.length - 1].update_id + 1 }, { merge: true });
    return linked;
  }

  const notifyCache = new Map();
  async function notifyOf(uid) {
    if (!notifyCache.has(uid)) notifyCache.set(uid, (await db.collection('notify').doc(uid).get()).data() ?? null);
    return notifyCache.get(uid);
  }

  /** 2. Alerts due now → Telegram. */
  async function sendAlerts() {
    const t = now().getTime();
    const due = await db
      .collection('outbox')
      .where('sent', '==', false)
      .where('at', '<=', Timestamp.fromMillis(t + LEAD_MS))
      .get();
    let sent = 0;
    for (const d of due.docs) {
      const a = d.data();
      const late = a.at.toMillis() < t - STALE_MS;
      const n = late ? null : await notifyOf(a.uid);
      if (n?.telegramChatId && n.telegramAlerts !== false && tgBase) {
        try {
          await say(n.telegramChatId, `🔔 ${a.title}${a.body ? `\n${a.body}` : ''}`);
          sent += 1;
        } catch (e) {
          log(`telegram alert failed for ${a.uid}: ${e.message}`);
          continue; // retried next run (until stale)
        }
      }
      await d.ref.update({ sent: true, sentAt: Timestamp.fromMillis(t), skipped: !n?.telegramChatId || late });
    }
    return sent;
  }

  /** 3. Daily summaries at each user's local time. */
  async function sendDigests() {
    const t = now();
    const [byEmail, byTelegram] = await Promise.all([
      db.collection('notify').where('emailDaily', '==', true).get(),
      db.collection('notify').where('telegramDaily', '==', true).get(),
    ]);
    const users = new Map([...byEmail.docs, ...byTelegram.docs].map((d) => [d.id, d]));
    let sent = 0;
    for (const [uid, docSnap] of users) {
      const n = docSnap.data();
      const { date, time } = localNow(n.timeZone || 'Europe/Madrid', t);
      const texts = msg(n.lang);
      const channels = [
        {
          on: n.emailDaily && n.email && mailer,
          at: n.emailTime,
          last: 'lastEmailDay',
          send: async (dg) => {
            await mailer.sendMail({
              from: mailFrom,
              to: n.email,
              subject: texts.subject(dg.title),
              text: `${digestText(dg, texts.summary)}\n\n${texts.footer}`,
              html: digestHtml(dg, texts.summary, texts.footer),
            });
          },
        },
        {
          on: n.telegramDaily && n.telegramChatId && tgBase,
          at: n.telegramTime,
          last: 'lastTelegramDay',
          send: (dg) => say(n.telegramChatId, digestText(dg, `☀️ ${texts.summary}`)),
        },
      ];
      for (const c of channels) {
        if (!c.on || n[c.last] === date) continue;
        const delay = minutes(time) - minutes(c.at);
        if (delay < 0) continue; // not yet
        // Many hours late (job was down): skip, but without closing the day, so
        // changing the time to later today still sends it.
        if (delay * 60_000 > DAILY_LATE_MS) continue;
        // No summary published for today (AUN not opened this week): try again next run.
        const dg = (await db.collection('digests').doc(`${uid}_${date}`).get()).data();
        if (!dg) continue;
        try {
          await c.send(dg);
          sent += 1;
        } catch (e) {
          log(`daily summary failed for ${uid}: ${e.message}`);
          continue;
        }
        await docSnap.ref.update({ [c.last]: date });
      }
    }
    return sent;
  }

  /** Old sent alerts and past summaries are removed. */
  async function cleanup() {
    const t = now().getTime();
    const old = await db
      .collection('outbox')
      .where('sent', '==', true)
      .where('at', '<', Timestamp.fromMillis(t - KEEP_SENT_MS))
      .limit(400)
      .get();
    const batch = db.batch();
    old.docs.forEach((d) => batch.delete(d.ref));
    if (!old.empty) await batch.commit();
    return old.size;
  }

  return {
    linkTelegram,
    sendAlerts,
    sendDigests,
    cleanup,
    async runOnce() {
      const result = {};
      for (const [name, step] of Object.entries({ linkTelegram, sendAlerts, sendDigests, cleanup })) {
        try {
          result[name] = await step();
        } catch (e) {
          result[name] = `error: ${e.message}`;
        }
      }
      return result;
    },
  };
}

// ---------------------------------------------------------------------------
// CLI (GitHub Actions)
// ---------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const env = process.env;
  if (!env.FIREBASE_SERVICE_ACCOUNT && !env.FIRESTORE_EMULATOR_HOST) {
    console.log('FIREBASE_SERVICE_ACCOUNT is not set: nothing to do (see docs/NOTIFICACIONES.md).');
    process.exit(0);
  }
  const app = env.FIRESTORE_EMULATOR_HOST
    ? initializeApp({ projectId: env.FIREBASE_PROJECT_ID || 'demo-aun' })
    : initializeApp({ credential: cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT)) });
  const mailer =
    env.EMAIL_TRANSPORT === 'json'
      ? nodemailer.createTransport({ jsonTransport: true })
      : env.GMAIL_USER && env.GMAIL_APP_PASSWORD
        ? nodemailer.createTransport({ service: 'gmail', auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD } })
        : null;
  const notifier = createNotifier({
    db: getFirestore(app),
    telegramToken: env.TELEGRAM_BOT_TOKEN || null,
    telegramApi: env.TELEGRAM_API || undefined,
    mailer,
    mailFrom: env.GMAIL_USER ? `AUN <${env.GMAIL_USER}>` : 'AUN <aun@localhost>',
  });
  const result = await notifier.runOnce();
  console.log(JSON.stringify(result));
  if (Object.values(result).some((v) => typeof v === 'string' && v.startsWith('error'))) process.exitCode = 1;
}
