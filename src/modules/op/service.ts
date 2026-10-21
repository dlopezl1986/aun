import type { CalendarService } from '@/modules/calendars/service';
import type { Repository } from '@/storage/repository';
import { addDays, fromDateKey, toDateKey, type DateKey } from '@/utils/date';
import { mondayIndex } from '@/utils/recurrence';
import type { OpSession, OpTopic } from './types';

/** What the OP calendar looks like (name in the user's language). */
export interface OpCalendarLook {
  name: string;
  color: string;
}

export type SessionPatch = Partial<Pick<OpSession, 'topicIds' | 'doneTopicIds' | 'hours' | 'behind' | 'tomorrow' | 'notes'>>;

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
const hasContent = (s: OpSession) => !!(s.hours || s.behind.trim() || s.tomorrow.trim() || s.notes.trim() || s.doneTopicIds.length);

/**
 * OP (oposición): the syllabus, the study plan (a session per study day, also
 * shown as an event in the user's own "Oposición" calendar), hours and notes.
 */
export class OpService {
  constructor(
    private readonly topics: Repository<OpTopic>,
    private readonly sessions: Repository<OpSession>,
    private readonly calendars: CalendarService,
  ) {}

  // ---------- Syllabus ----------

  async listTopics(): Promise<OpTopic[]> {
    return (await this.topics.list()).sort((a, b) => a.number - b.number || a.createdAt.localeCompare(b.createdAt));
  }

  async addTopic(number: number, title = ''): Promise<OpTopic> {
    if (!Number.isInteger(number) || number < 1) throw new Error('Invalid topic number');
    return this.topics.create({ number, title: title.trim(), studied: false });
  }

  /** "Temas del 1 al 40": adds the numbers that are not there yet. Returns how many were added. */
  async addTopicRange(from: number, to: number): Promise<number> {
    const have = new Set((await this.topics.list()).map((t) => t.number));
    let n = 0;
    for (let i = Math.max(1, Math.min(from, to)); i <= Math.max(from, to); i++) {
      if (have.has(i)) continue;
      await this.topics.create({ number: i, title: '', studied: false });
      n += 1;
    }
    return n;
  }

  updateTopic(id: string, patch: Partial<Pick<OpTopic, 'number' | 'title' | 'studied'>>): Promise<OpTopic> {
    return this.topics.update(id, { ...patch, ...(patch.title !== undefined ? { title: patch.title.trim() } : {}) });
  }

  /** Removes a topic (and takes it out of the study days that had it). */
  async removeTopic(id: string, look: OpCalendarLook): Promise<void> {
    await this.topics.remove(id);
    for (const s of await this.sessions.list()) {
      if (!s.topicIds.includes(id) && !s.doneTopicIds.includes(id)) continue;
      await this.updateSession(
        s.id,
        { topicIds: s.topicIds.filter((x) => x !== id), doneTopicIds: s.doneTopicIds.filter((x) => x !== id) },
        look,
      );
    }
  }

  // ---------- Study days ----------

  async listSessions(): Promise<OpSession[]> {
    return (await this.sessions.list()).sort((a, b) => a.date.localeCompare(b.date));
  }

  async sessionOn(date: DateKey): Promise<OpSession | null> {
    return (await this.sessions.list()).find((s) => s.date === date) ?? null;
  }

  /** "OP · T1, T2, T5" */
  private async eventTitle(topicIds: string[]): Promise<string> {
    const topics = await this.listTopics();
    const numbers = topics.filter((t) => topicIds.includes(t.id)).map((t) => `T${t.number}`);
    return numbers.length ? `OP · ${numbers.join(', ')}` : 'OP';
  }

  /** Keeps the session's calendar event in step (creates it, or renames it). */
  private async syncEvent(s: OpSession, look: OpCalendarLook): Promise<OpSession> {
    const title = await this.eventTitle(s.topicIds);
    const existing = s.eventId ? await this.calendars.getEvent(s.eventId) : null;
    if (existing) {
      if (existing.title !== title) await this.calendars.retitleEvent(existing.id, title);
      return s;
    }
    const cal = await this.calendars.ensurePurposeCalendar('op', { ...look, icon: 'book' });
    const event = await this.calendars.createEvent({ calendarId: cal.id, title, allDay: true, startDate: s.date });
    return this.sessions.update(s.id, { eventId: event.id });
  }

  /**
   * Plan mode: tap a day with some topics selected. Adds them to that day
   * (creating the study day), or — if the day already has all of them — takes
   * them off again. A day is only removed when nothing was recorded on it.
   */
  async planDay(date: DateKey, topicIds: string[], look: OpCalendarLook): Promise<'created' | 'updated' | 'removed' | 'kept'> {
    if (!topicIds.length) return 'kept';
    const s = await this.sessionOn(date);
    if (!s) {
      const created = await this.sessions.create({
        date,
        topicIds: [...topicIds],
        doneTopicIds: [],
        hours: null,
        behind: '',
        tomorrow: '',
        notes: '',
        eventId: null,
      });
      await this.syncEvent(created, look);
      return 'created';
    }
    const allThere = topicIds.every((id) => s.topicIds.includes(id));
    const next = allThere ? s.topicIds.filter((id) => !topicIds.includes(id)) : [...new Set([...s.topicIds, ...topicIds])];
    if (!next.length && !hasContent(s)) {
      await this.removeSession(s.id);
      return 'removed';
    }
    if (sameSet(next, s.topicIds)) return 'kept';
    await this.updateSession(s.id, { topicIds: next, doneTopicIds: s.doneTopicIds.filter((id) => next.includes(id)) }, look);
    return 'updated';
  }

  /** A study day opened from the calendar / list that has no session yet. */
  async createSession(date: DateKey, patch: SessionPatch, look: OpCalendarLook): Promise<OpSession> {
    const created = await this.sessions.create({
      date,
      topicIds: patch.topicIds ?? [],
      doneTopicIds: patch.doneTopicIds ?? [],
      hours: patch.hours ?? null,
      behind: patch.behind ?? '',
      tomorrow: patch.tomorrow ?? '',
      notes: patch.notes ?? '',
      eventId: null,
    });
    return this.syncEvent(created, look);
  }

  async updateSession(id: string, patch: SessionPatch, look: OpCalendarLook): Promise<OpSession> {
    const updated = await this.sessions.update(id, {
      ...patch,
      ...(patch.hours !== undefined ? { hours: patch.hours && patch.hours > 0 ? patch.hours : null } : {}),
    });
    return patch.topicIds ? this.syncEvent(updated, look) : updated;
  }

  async removeSession(id: string): Promise<void> {
    const s = (await this.sessions.list()).find((x) => x.id === id);
    if (!s) return;
    if (s.eventId && (await this.calendars.getEvent(s.eventId))) await this.calendars.deleteEvent(s.eventId);
    await this.sessions.remove(id);
  }

  // ---------- Notes carried over & totals ----------

  /** The last study day before `date` that left something for later ("lo que se quedó atrás", "para mañana"). */
  async carriedNotes(date: DateKey): Promise<OpSession | null> {
    const before = (await this.listSessions()).filter((s) => s.date < date && (s.behind.trim() || s.tomorrow.trim()));
    return before[before.length - 1] ?? null;
  }
}

/** Hours studied between two days (both included). */
export function hoursBetween(sessions: OpSession[], from: DateKey, to: DateKey): number {
  return sessions.filter((s) => s.date >= from && s.date <= to).reduce((n, s) => n + (s.hours ?? 0), 0);
}

/** Today, this week (Monday to Sunday), this month and all time. */
export function opTotals(sessions: OpSession[], today: DateKey) {
  const d = fromDateKey(today);
  const monday = toDateKey(addDays(d, -mondayIndex(d)));
  const sunday = toDateKey(addDays(fromDateKey(monday), 6));
  const month = today.slice(0, 7);
  return {
    today: hoursBetween(sessions, today, today),
    week: hoursBetween(sessions, monday, sunday),
    month: hoursBetween(sessions, `${month}-01`, `${month}-31`),
    total: sessions.reduce((n, s) => n + (s.hours ?? 0), 0),
  };
}

/** Approximate hours per topic: each day's hours shared among the topics planned that day. */
export function hoursPerTopic(sessions: OpSession[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of sessions) {
    if (!s.hours || !s.topicIds.length) continue;
    const each = s.hours / s.topicIds.length;
    for (const id of s.topicIds) map.set(id, (map.get(id) ?? 0) + each);
  }
  return map;
}
