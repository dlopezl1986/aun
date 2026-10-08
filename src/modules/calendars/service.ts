import type { Repository } from '@/storage/repository';
import type { EntityRef } from '@/types/entity';
import type { RecurrenceRule } from '@/types/recurrence';
import { matchScore, type SearchResult } from '@/types/search';
import { addDays, combine, startOfDay, toDateKey, type DateKey } from '@/utils/date';
import { expandOccurrences } from '@/utils/recurrence';
import { NOTE_COLORS, type Calendar, type CalendarEvent, type DayNote, type EventOccurrence } from './types';

export interface CalendarInput {
  name: string;
  color: string;
  description?: string | null;
  icon?: string | null;
}

export interface EventInput {
  calendarId: string;
  title: string;
  allDay: boolean;
  startDate: DateKey;
  startTime?: string | null;
  /** Defaults to startDate. For all-day events: last day included. */
  endDate?: DateKey | null;
  endTime?: string | null;
  location?: string | null;
  description?: string | null;
  notes?: string | null;
  /** Own colour; `null` = the calendar's. */
  color?: string | null;
  participants?: string[];
  reminders?: number[];
  recurrence?: RecurrenceRule | null;
  links?: EntityRef[];
}

export class EventValidationError extends Error {
  constructor(public readonly field: 'title' | 'calendar') {
    super(field);
    this.name = 'EventValidationError';
  }
}

const HOUR = 60 * 60 * 1000;

/** Builds the stored [start, end) of an event from form input. */
export function eventTimes(input: Pick<EventInput, 'allDay' | 'startDate' | 'startTime' | 'endDate' | 'endTime'>): {
  start: Date;
  end: Date;
} {
  const endDate = input.endDate && input.endDate >= input.startDate ? input.endDate : input.startDate;
  if (input.allDay) {
    // All-day: local midnight → midnight after the last included day.
    return { start: combine(input.startDate), end: addDays(combine(endDate), 1) };
  }
  const start = combine(input.startDate, input.startTime ?? '09:00');
  let end = combine(endDate, input.endTime ?? input.startTime ?? '10:00');
  if (end <= start) end = new Date(start.getTime() + HOUR);
  return { start, end };
}

/** Links of an event (Phase 1 `attachments` are migrated transparently). */
export function eventLinks(event: CalendarEvent): EntityRef[] {
  return event.links ?? event.attachments ?? [];
}

export interface DayNoteInput {
  date: DateKey;
  text: string;
  color?: string;
  remindAt?: string | null;
}

export class CalendarService {
  constructor(
    private readonly calendars: Repository<Calendar>,
    private readonly events: Repository<CalendarEvent>,
    private readonly notes?: Repository<DayNote>,
  ) {}

  // ---------- Calendars ----------

  async listCalendars(): Promise<Calendar[]> {
    return (await this.calendars.list()).sort((a, b) => a.order - b.order);
  }

  async createCalendar(input: CalendarInput): Promise<Calendar> {
    const name = input.name.trim();
    if (!name) throw new Error('Calendar name is required');
    const count = (await this.calendars.list()).length;
    return this.calendars.create({
      name,
      color: input.color,
      description: input.description?.trim() || null,
      icon: input.icon ?? null,
      isActive: true,
      isVisible: true,
      order: count,
    });
  }

  updateCalendar(id: string, patch: Partial<CalendarInput & { isActive: boolean }>): Promise<Calendar> {
    return this.calendars.update(id, { ...patch, ...(patch.name !== undefined ? { name: patch.name.trim() } : {}) });
  }

  async deleteCalendar(id: string): Promise<void> {
    const ids = (await this.events.list()).filter((e) => e.calendarId === id).map((e) => e.id);
    await this.events.removeMany(ids);
    await this.calendars.remove(id);
  }

  setVisible(id: string, isVisible: boolean): Promise<Calendar> {
    return this.calendars.update(id, { isVisible });
  }

  async showAll(): Promise<void> {
    const hidden = (await this.calendars.list()).filter((c) => !c.isVisible);
    for (const c of hidden) await this.calendars.update(c.id, { isVisible: true });
  }

  // ---------- Events ----------

  getEvent(id: string): Promise<CalendarEvent | null> {
    return this.events.get(id);
  }

  private async validate(input: EventInput): Promise<string> {
    const title = input.title.trim();
    if (!title) throw new EventValidationError('title');
    const calendar = await this.calendars.get(input.calendarId);
    if (!calendar || !calendar.isActive) throw new EventValidationError('calendar');
    return title;
  }

  private toRecord(input: EventInput, title: string) {
    const { start, end } = eventTimes(input);
    return {
      calendarId: input.calendarId,
      title,
      start: start.toISOString(),
      end: end.toISOString(),
      allDay: input.allDay,
      location: input.location?.trim() || null,
      description: input.description?.trim() || null,
      notes: input.notes?.trim() || null,
      color: input.color || null,
      participants: (input.participants ?? []).map((p) => p.trim()).filter(Boolean),
      reminders: [...new Set(input.reminders ?? [])].sort((a, b) => a - b),
      recurrence: input.recurrence ?? null,
      links: input.links ?? [],
    };
  }

  async createEvent(input: EventInput): Promise<CalendarEvent> {
    const title = await this.validate(input);
    return this.events.create({ ...this.toRecord(input, title), exdates: [], attachments: [] });
  }

  /** Edits the whole event (all occurrences of a series). */
  async updateEvent(id: string, input: EventInput): Promise<CalendarEvent> {
    const title = await this.validate(input);
    return this.events.update(id, this.toRecord(input, title));
  }

  async duplicateEvent(id: string): Promise<CalendarEvent> {
    const e = await this.events.get(id);
    if (!e) throw new Error('Event not found');
    const { id: _id, ownerId: _o, createdAt: _c, updatedAt: _u, deletedAt: _d, ...copy } = e;
    return this.events.create({ ...copy, exdates: [] });
  }

  deleteEvent(id: string): Promise<void> {
    return this.events.remove(id);
  }

  /** "Solo este evento": removes one occurrence of a recurring event. */
  async deleteOccurrence(id: string, date: DateKey): Promise<void> {
    const e = await this.events.get(id);
    if (!e) return;
    await this.events.update(id, { exdates: [...new Set([...(e.exdates ?? []), date])] });
  }

  /**
   * Occurrences overlapping [from, to) for visible & active calendars,
   * with recurring events expanded.
   */
  async occurrencesBetween(from: Date, to: Date, opts: { includeHidden?: boolean } = {}): Promise<EventOccurrence[]> {
    // Hidden calendars still notify (visibility is a display filter); archived ones don't.
    const calendars = new Map(
      (await this.calendars.list()).filter((c) => c.isActive && (opts.includeHidden || c.isVisible)).map((c) => [c.id, c]),
    );
    const result: EventOccurrence[] = [];
    for (const event of await this.events.list()) {
      const calendar = calendars.get(event.calendarId);
      if (!calendar) continue;
      const first = new Date(event.start);
      const durationMs = Math.max(new Date(event.end).getTime() - first.getTime(), 0);
      const starts = expandOccurrences({ start: first, durationMs, rule: event.recurrence, from, to, exdates: event.exdates });
      for (const start of starts) {
        result.push({ key: `${event.id}:${toDateKey(start)}`, event, calendar, start, end: new Date(start.getTime() + durationMs) });
      }
    }
    return result.sort((a, b) => Number(b.event.allDay) - Number(a.event.allDay) || a.start.getTime() - b.start.getTime());
  }

  occurrencesOnDay(day: Date): Promise<EventOccurrence[]> {
    const from = startOfDay(day);
    return this.occurrencesBetween(from, addDays(from, 1));
  }

  /** Events of active calendars with their calendar (link pickers), newest first. */
  async linkableEvents(): Promise<{ event: CalendarEvent; calendar: Calendar }[]> {
    const calendars = new Map((await this.calendars.list()).filter((c) => c.isActive).map((c) => [c.id, c]));
    return (await this.events.list())
      .filter((e) => calendars.has(e.calendarId))
      .map((event) => ({ event, calendar: calendars.get(event.calendarId)! }))
      .sort((a, b) => (a.event.start < b.event.start ? 1 : -1));
  }

  /** Events linked to an entity of another module (e.g. a child in Familia). */
  async eventsLinkedTo(ref: EntityRef): Promise<CalendarEvent[]> {
    return (await this.events.list()).filter((e) =>
      eventLinks(e).some((l) => l.module === ref.module && l.type === ref.type && l.id === ref.id),
    );
  }

  /** Upcoming occurrences (recurrence expanded) of events linked to `ref`, from `from` for `days` days. */
  async linkedOccurrences(ref: EntityRef, from: Date, days: number, calendarId?: string | null): Promise<EventOccurrence[]> {
    const ids = new Set((await this.eventsLinkedTo(ref)).map((e) => e.id));
    if (!ids.size && !calendarId) return [];
    const all = await this.occurrencesBetween(startOfDay(from), addDays(startOfDay(from), days), { includeHidden: true });
    return all.filter((o) => ids.has(o.event.id) || o.calendar.id === calendarId).sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  // ---------- Day notes ----------

  private notesRepo(): Repository<DayNote> {
    if (!this.notes) throw new Error('Day notes are not configured');
    return this.notes;
  }

  /** Notes of the days in [from, to] (date keys, inclusive), by day then creation. */
  async notesBetween(from: DateKey, to: DateKey): Promise<DayNote[]> {
    if (!this.notes) return [];
    return (await this.notes.list())
      .filter((n) => n.date >= from && n.date <= to)
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  }

  async addDayNote(input: DayNoteInput): Promise<DayNote> {
    const text = input.text.trim();
    if (!text) throw new EventValidationError('title');
    return this.notesRepo().create({
      date: input.date,
      text,
      color: input.color ?? NOTE_COLORS[0],
      done: false,
      remindAt: input.remindAt || null,
    });
  }

  async updateDayNote(id: string, patch: Partial<DayNoteInput & { done: boolean }>): Promise<DayNote> {
    const text = patch.text?.trim();
    if (patch.text !== undefined && !text) throw new EventValidationError('title');
    return this.notesRepo().update(id, {
      ...patch,
      ...(text !== undefined ? { text } : {}),
      ...(patch.remindAt !== undefined ? { remindAt: patch.remindAt || null } : {}),
    });
  }

  removeDayNote(id: string): Promise<void> {
    return this.notesRepo().remove(id);
  }

  /** Events (by title/location) and calendars (by name) for the global search. */
  async search(text: string): Promise<SearchResult[]> {
    const calendars = await this.listCalendars();
    const byId = new Map(calendars.map((c) => [c.id, c]));
    const results: SearchResult[] = [];
    for (const c of calendars) {
      const score = matchScore(c.name, text);
      if (score) {
        results.push({
          ref: { module: 'calendars', type: 'calendar', id: c.id },
          title: c.name,
          kindKey: 'search.kinds.calendar',
          score,
          route: '/calendars',
        });
      }
    }
    for (const e of await this.events.list()) {
      const calendar = byId.get(e.calendarId);
      if (!calendar) continue;
      const score = Math.max(matchScore(e.title, text), matchScore(e.location ?? '', text) ? 1 : 0);
      if (!score) continue;
      results.push({
        ref: { module: 'calendars', type: 'event', id: e.id },
        title: e.title,
        kindKey: e.recurrence ? 'search.kinds.recurringEvent' : 'search.kinds.event',
        subtitle: calendar.name,
        date: e.start,
        score,
        route: `/calendars?event=${e.id}`,
      });
    }
    for (const n of await this.notesBetween('0000-01-01', '9999-12-31')) {
      const score = matchScore(n.text, text);
      if (!score) continue;
      results.push({
        ref: { module: 'calendars', type: 'note', id: n.id },
        title: n.text,
        kindKey: 'search.kinds.dayNote',
        date: combine(n.date, '12:00').toISOString(),
        score,
        route: `/calendars?day=${n.date}`,
      });
    }
    return results;
  }
}
