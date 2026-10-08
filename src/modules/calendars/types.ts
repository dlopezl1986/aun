import type { BaseEntity, EntityRef } from '@/types/entity';
import type { RecurrenceRule } from '@/types/recurrence';
import type { DateKey } from '@/utils/date';

export interface Calendar extends BaseEntity {
  name: string;
  color: string;
  /** Optional Feather icon name. */
  icon?: string | null;
  description?: string | null;
  /** Inactive calendars are kept but hidden everywhere (archived). */
  isActive: boolean;
  /** User's visibility filter ("☑ David ☐ Trabajo"). */
  isVisible: boolean;
  order: number;
}

export interface CalendarEvent extends BaseEntity {
  calendarId: string;
  title: string;
  description?: string | null;
  /** ISO datetime of the first occurrence. All-day events: local start of day. */
  start: string;
  end: string;
  allDay: boolean;
  location?: string | null;
  participants: string[];
  /** Minutes before start (0 = at start). Delivered by Notifications (Phase 8). */
  reminders: number[];
  recurrence?: RecurrenceRule | null;
  /** Occurrence dates removed from a series ("solo este evento"). */
  exdates?: DateKey[];
  notes?: string | null;
  /** Cross-module links: 2ndBrain documents, Familia children… (section 48). */
  links?: EntityRef[];
  /** @deprecated Phase 1 field, superseded by `links`. */
  attachments?: EntityRef[];
}

export interface EventOccurrence {
  /** Stable per occurrence: `${event.id}:${dateKey}`. */
  key: string;
  event: CalendarEvent;
  calendar: Calendar;
  start: Date;
  end: Date;
}

/** Sticky-note colours for day notes. */
export const NOTE_COLORS = ['#FACC15', '#FB923C', '#F472B6', '#60A5FA', '#4ADE80'] as const;

/**
 * A note pinned to a day ("Llamar al pediatra", "Cumple de la abuela"):
 * a reminder, not an appointment — no duration, optionally an alert time.
 */
export interface DayNote extends BaseEntity {
  date: DateKey;
  text: string;
  color: string;
  done: boolean;
  /** "HH:MM" — shows up in Notificaciones at that time on `date`. */
  remindAt?: string | null;
}
