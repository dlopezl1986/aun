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
  /** Created by a module for its own use (e.g. 'op': study sessions of OP). */
  purpose?: string | null;
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
  /**
   * Own colour (e.g. each work shift in its colour). Shown as the fill; the
   * calendar colour stays as the stripe so you still see whose event it is.
   */
  color?: string | null;
  /** Cross-module links: 2ndBrain documents, Familia children… (section 48). */
  links?: EntityRef[];
  /** Added with a shift label in shift mode (so it can be erased / toggled there). */
  shiftTypeId?: string | null;
  /** Hours this shift counts (copied from its label when painted, so later label changes keep the past right). */
  shiftHours?: number | null;
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

/** Fill colour of an occurrence: its own colour, else its calendar's. */
export const occurrenceColor = (o: Pick<EventOccurrence, 'event' | 'calendar'>): string => o.event.color || o.calendar.color;

/**
 * A shift label ("Mañana 07–15", "Noche", "Libre"…) the user creates once and
 * then paints on days in shift mode. Private to its owner, synced.
 */
export interface ShiftType extends BaseEntity {
  name: string;
  color: string;
  allDay: boolean;
  /** HH:mm; a shift whose end is not after its start ends the next day (nights). */
  start: string;
  end: string;
  order: number;
  /** Hours it counts in the totals (may differ from its span: breaks, paid nights…). Missing = its duration. */
  hours?: number;
  /** Counted-hours defaults this label was last brought up to date with (SHIFT_HOURS_REV). */
  hoursRev?: number;
}
