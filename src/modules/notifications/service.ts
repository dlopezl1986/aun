import type { Repository } from '@/storage/repository';
import type { RecurrenceRule } from '@/types/recurrence';
import { matchScore, type SearchResult } from '@/types/search';
import { combine, type DateKey } from '@/utils/date';
import { expandOccurrences } from '@/utils/recurrence';
import type { AppNotification, Reminder } from './types';

export interface ReminderInput {
  title: string;
  date: DateKey;
  time: string;
  recurrence?: RecurrenceRule | null;
}

/** Next occurrence strictly after `after` (null when the series has ended). */
export function nextReminderTime(r: Pick<Reminder, 'at' | 'recurrence'>, after: Date): Date | null {
  if (!r.recurrence) return null;
  const start = new Date(r.at);
  const [next] = expandOccurrences({
    start,
    durationMs: 0,
    rule: r.recurrence,
    from: new Date(Math.max(after.getTime(), start.getTime()) + 1),
    to: new Date(after.getTime() + 400 * 24 * 3_600_000),
    limit: 1,
  });
  return next ?? null;
}

/**
 * Central notification hub (sections 38–39): manual reminders (one-off or
 * recurring) + persisted in-app notifications. Alerts of the other modules
 * are computed from their own data (AlertSource), never duplicated here.
 */
export class NotificationService {
  constructor(
    private readonly notifications: Repository<AppNotification>,
    private readonly reminders: Repository<Reminder>,
  ) {}

  /** Notifications from enabled modules only (disabled modules emit nothing). */
  async listNotifications(enabledModules: Set<string>): Promise<AppNotification[]> {
    return (await this.notifications.list()).filter((n) => enabledModules.has(n.sourceModule)).sort((a, b) => (a.at < b.at ? 1 : -1));
  }

  async markAllRead(): Promise<void> {
    const stamp = new Date().toISOString();
    for (const n of (await this.notifications.list()).filter((x) => !x.readAt)) {
      await this.notifications.update(n.id, { readAt: stamp });
    }
  }

  async listReminders(): Promise<Reminder[]> {
    return (await this.reminders.list()).sort((a, b) => Number(a.done) - Number(b.done) || (a.at < b.at ? -1 : 1));
  }

  async createReminder(input: ReminderInput): Promise<Reminder> {
    const title = input.title.trim();
    if (!title) throw new Error('Title is required');
    return this.reminders.create({
      title,
      at: combine(input.date, input.time).toISOString(),
      recurrence: input.recurrence ?? null,
      done: false,
    });
  }

  async updateReminder(id: string, input: ReminderInput): Promise<Reminder> {
    const title = input.title.trim();
    if (!title) throw new Error('Title is required');
    return this.reminders.update(id, {
      title,
      at: combine(input.date, input.time).toISOString(),
      recurrence: input.recurrence ?? null,
      done: false,
    });
  }

  /**
   * "Hecho": a one-off reminder is completed; a recurring one jumps to its
   * next occurrence (and only ends when the series does).
   */
  async completeReminder(r: Reminder, now = new Date()): Promise<{ reminder: Reminder; next: string | null }> {
    if (r.done) return { reminder: await this.reminders.update(r.id, { done: false }), next: null };
    const next = nextReminderTime(r, new Date(Math.max(now.getTime(), new Date(r.at).getTime())));
    if (next) return { reminder: await this.reminders.update(r.id, { at: next.toISOString() }), next: next.toISOString() };
    return { reminder: await this.reminders.update(r.id, { done: true }), next: null };
  }

  /** Postpone ("Posponer 10 min / 1 h / mañana"). */
  snoozeReminder(r: Reminder, minutes: number, now = new Date()): Promise<Reminder> {
    return this.reminders.update(r.id, { at: new Date(now.getTime() + minutes * 60_000).toISOString(), done: false });
  }

  removeReminder(id: string): Promise<void> {
    return this.reminders.remove(id);
  }

  /** Occurrences of pending reminders inside [from, to] (recurring ones expanded). */
  async reminderOccurrences(from: Date, to: Date): Promise<{ reminder: Reminder; at: Date }[]> {
    const out: { reminder: Reminder; at: Date }[] = [];
    for (const r of await this.reminders.list()) {
      if (r.done) continue;
      const start = new Date(r.at);
      const times = r.recurrence
        ? expandOccurrences({ start, durationMs: 0, rule: r.recurrence, from, to: new Date(to.getTime() + 1), limit: 200 })
        : start >= from && start <= to
          ? [start]
          : [];
      for (const at of times) out.push({ reminder: r, at });
    }
    return out;
  }

  async search(text: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    for (const r of await this.reminders.list()) {
      const score = matchScore(r.title, text);
      if (!score) continue;
      results.push({
        ref: { module: 'notifications', type: 'reminder', id: r.id },
        title: r.title,
        kindKey: 'search.kinds.reminder',
        date: r.at,
        score: score + (r.done ? 0 : 1),
        route: '/notifications',
      });
    }
    return results;
  }
}
