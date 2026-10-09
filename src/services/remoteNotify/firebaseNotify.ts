import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, Timestamp, where, writeBatch } from 'firebase/firestore';

import { firebaseAuth, firebaseDb } from '@/services/backend/firebase';
import type { AlertItem } from '@/types/module';
import { createId } from '@/utils/id';
import type { Digest } from './digest';

/**
 * Notices outside the app (Firebase backend). The app publishes what to send;
 * the notifier job (notifier/, GitHub Actions every 5 min) sends it:
 *   notify/{uid}            channels and times chosen by the user
 *   outbox/{uid}_{hash}     each alert, with the moment to send it
 *   digests/{uid}_{date}    the daily summary, already written
 */
export interface NotifySettings {
  /** Account e-mail (the rules only allow your own). */
  email: string | null;
  emailDaily: boolean;
  emailTime: string;
  /** Set by the notifier when you press Start in Telegram (never by the app). */
  telegramChatId: string | null;
  telegramName: string | null;
  telegramLinkCode: string | null;
  telegramAlerts: boolean;
  telegramDaily: boolean;
  telegramTime: string;
  timeZone: string;
  lang: string;
}

export const defaultNotifySettings = (email: string | null, lang: string): NotifySettings => ({
  email,
  emailDaily: false,
  emailTime: '07:30',
  telegramChatId: null,
  telegramName: null,
  telegramLinkCode: null,
  telegramAlerts: true,
  telegramDaily: false,
  telegramTime: '07:30',
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid',
  lang,
});

/** Stable short id for an alert key (keys may contain characters Firestore ids do not allow). */
export function alertDocId(uid: string, key: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
  }
  return `${uid}_${h1.toString(36)}${h2.toString(36)}`;
}

/** Alerts already past by more than this are not published (they would arrive late). */
const PAST_TOLERANCE_MS = 10 * 60_000;

export class FirebaseNotifyService {
  constructor(readonly me: string) {}

  private get db() {
    return firebaseDb();
  }

  async get(lang: string): Promise<NotifySettings> {
    const snap = await getDoc(doc(this.db, 'notify', this.me));
    const base = defaultNotifySettings(firebaseAuth().currentUser?.email ?? null, lang);
    return snap.exists() ? { ...base, ...(snap.data() as Partial<NotifySettings>) } : base;
  }

  async save(patch: Partial<Omit<NotifySettings, 'telegramChatId' | 'telegramName'>>, lang: string): Promise<NotifySettings> {
    const current = await this.get(lang);
    const next = {
      ...current,
      ...patch,
      email: firebaseAuth().currentUser?.email ?? current.email,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || current.timeZone,
      lang,
      updatedAt: Timestamp.now(),
    };
    await setDoc(doc(this.db, 'notify', this.me), next);
    return next;
  }

  /** A one-time code: the Telegram link sends it to the bot, which then knows your chat. */
  async startTelegramLink(lang: string): Promise<string> {
    const code = createId().replace(/-/g, '').slice(0, 24);
    await this.save({ telegramLinkCode: code }, lang);
    return code;
  }

  async disconnectTelegram(lang: string): Promise<void> {
    const current = await this.get(lang);
    await setDoc(doc(this.db, 'notify', this.me), {
      ...current,
      telegramChatId: null,
      telegramName: null,
      telegramLinkCode: null,
      updatedAt: Timestamp.now(),
    });
  }

  /**
   * Mirrors the upcoming alerts into the outbox: new ones are added, changed
   * ones updated, removed ones deleted. Alerts already sent are left alone so
   * they are never sent twice.
   */
  async publishAlerts(alerts: AlertItem[], now = Date.now()): Promise<number> {
    const snap = await getDocs(query(collection(this.db, 'outbox'), where('uid', '==', this.me)));
    const existing = new Map(snap.docs.map((d) => [d.id, d.data() as { sent?: boolean; at?: Timestamp; title?: string; body?: string }]));
    const wanted = new Map<string, AlertItem>();
    for (const a of alerts) if (new Date(a.at).getTime() > now - PAST_TOLERANCE_MS) wanted.set(alertDocId(this.me, a.key), a);
    let batch = writeBatch(this.db);
    let ops = 0;
    let changes = 0;
    const flush = async () => {
      if (ops) await batch.commit();
      batch = writeBatch(this.db);
      ops = 0;
    };
    for (const [id, a] of wanted) {
      const old = existing.get(id);
      if (old?.sent) continue;
      const at = Timestamp.fromDate(new Date(a.at));
      if (old && old.at?.isEqual(at) && old.title === a.title && (old.body ?? '') === (a.body ?? '')) continue;
      batch.set(doc(this.db, 'outbox', id), {
        uid: this.me,
        at,
        title: a.title,
        body: a.body ?? '',
        sent: false,
        createdAt: Timestamp.now(),
      });
      ops += 1;
      changes += 1;
      if (ops >= 400) await flush();
    }
    for (const [id, old] of existing) {
      if (wanted.has(id) || old.sent) continue;
      batch.delete(doc(this.db, 'outbox', id));
      ops += 1;
      changes += 1;
      if (ops >= 400) await flush();
    }
    await flush();
    return changes;
  }

  async publishDigests(digests: Digest[]): Promise<void> {
    const batch = writeBatch(this.db);
    for (const d of digests) batch.set(doc(this.db, 'digests', `${this.me}_${d.date}`), { uid: this.me, ...d, updatedAt: Timestamp.now() });
    await batch.commit();
  }

  /** Stops everything outside the app (pending alerts are removed). */
  async clearOutbox(): Promise<void> {
    const snap = await getDocs(query(collection(this.db, 'outbox'), where('uid', '==', this.me)));
    for (const d of snap.docs) if (!(d.data() as { sent?: boolean }).sent) await deleteDoc(d.ref);
  }
}
