import type { Services } from '@/services/container';
import { addDays, formatLongDate, formatTime, fromDateKey, type DateKey } from '@/utils/date';

/**
 * A day's summary ("Hoy tienes…") already written in the user's language, so
 * the sender (email / Telegram) only has to print it.
 */
export interface DigestSection {
  icon: string;
  heading: string;
  lines: string[];
}

export interface Digest {
  date: DateKey;
  title: string;
  sections: DigestSection[];
  /** Shown when there is nothing that day. */
  emptyText: string;
}

type T = (key: string, opts?: Record<string, unknown>) => string;

/** Builds the summary of `date` from the user's own data (shared calendars and family included). */
export async function buildDigest(services: Services, date: DateKey, locale: string, t: T): Promise<Digest> {
  const day = fromDateKey(date);
  const next = addDays(day, 1);
  const sections: DigestSection[] = [];

  const events = await services.calendars.occurrencesBetween(day, next);
  if (events.length) {
    sections.push({
      icon: '📅',
      heading: t('remote.digest.events'),
      lines: events.map((o) => {
        const when = o.event.allDay ? t('calendars.allDay') : formatTime(o.start, locale);
        return `${when} · ${o.event.title}${o.event.location ? ` (${o.event.location})` : ''} — ${o.calendar.name}`;
      }),
    });
  }

  const notes = (await services.calendars.notesBetween(date, date)).filter((n) => !n.done);
  if (notes.length) {
    sections.push({
      icon: '📝',
      heading: t('remote.digest.notes'),
      lines: notes.map((n) => (n.remindAt ? `${n.remindAt} · ${n.text}` : n.text)),
    });
  }

  const reminders = await services.notifications.reminderOccurrences(day, next);
  if (reminders.length) {
    sections.push({
      icon: '⏰',
      heading: t('remote.digest.reminders'),
      lines: reminders.map((r) => `${formatTime(r.at, locale)} · ${r.reminder.title}`),
    });
  }

  const tasks = (await services.tasks.list()).filter(
    (k) =>
      (k.status === 'pending' || k.status === 'in_progress') &&
      !k.parentTaskId &&
      ((k.dueDate && k.dueDate <= date) || k.deadline === date),
  );
  if (tasks.length) {
    sections.push({
      icon: '✅',
      heading: t('remote.digest.tasks'),
      lines: tasks.map(
        (k) => `${k.dueDate && k.dueDate < date ? `${t('remote.digest.overdue')} · ` : ''}${k.dueTime ? `${k.dueTime} · ` : ''}${k.title}`,
      ),
    });
  }

  const tomorrow = (await services.family.listItems('tomorrow', date)).filter((i) => !i.done);
  if (tomorrow.length) {
    sections.push({ icon: '🎒', heading: t('remote.digest.tomorrow'), lines: tomorrow.map((i) => i.title) });
  }

  const shopping = (await services.shopping.listItems()).filter((i) => !i.done);
  if (shopping.length) {
    sections.push({
      icon: '🛒',
      heading: t('remote.digest.shopping', { count: shopping.length }),
      lines: shopping.slice(0, 8).map((i) => (i.quantity ? `${i.quantity} ${i.title}` : i.title)),
    });
  }

  const title = formatLongDate(day, locale);
  return { date, title: title.charAt(0).toUpperCase() + title.slice(1), sections, emptyText: t('remote.digest.empty') };
}

/** Plain-text version (Telegram, and the e-mail fallback). */
export function digestText(d: Digest, heading: string): string {
  const parts = [`${heading} — ${d.title}`];
  if (!d.sections.length) parts.push('', d.emptyText);
  for (const s of d.sections) parts.push('', `${s.icon} ${s.heading}`, ...s.lines.map((l) => `• ${l}`));
  return parts.join('\n');
}
