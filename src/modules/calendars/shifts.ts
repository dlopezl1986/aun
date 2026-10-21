import { addDays, addMonths, fromDateKey, toDateKey, type DateKey } from '@/utils/date';

/** Work shifts offered in the event form ("De tarde"…). Hours are editable and remembered. */
export type ShiftId = 'morning' | 'afternoon' | 'night';
export interface ShiftHours {
  start: string;
  end: string;
}

export const SHIFT_IDS: ShiftId[] = ['morning', 'afternoon', 'night'];

export const DEFAULT_SHIFT_HOURS: Record<ShiftId, ShiftHours> = {
  morning: { start: '07:00', end: '15:00' },
  afternoon: { start: '15:00', end: '23:00' },
  night: { start: '23:00', end: '07:00' },
};

/** Each shift in its own colour by default (amber morning, violet afternoon, slate night). */
export const DEFAULT_SHIFT_COLORS: Record<ShiftId, string> = {
  morning: '#F59E0B',
  afternoon: '#8B5CF6',
  night: '#64748B',
};

/** Hours each usual shift counts by default (a morning or afternoon 7 h, a night 10 h). */
export const DEFAULT_SHIFT_COUNTED_HOURS: Record<ShiftId, number> = { morning: 7, afternoon: 7, night: 10 };
/** The first defaults (21 Oct 2026), corrected on labels and shifts that still have them. */
export const LEGACY_SHIFT_COUNTED_HOURS: Record<ShiftId, number> = { morning: 7.5, afternoon: 7.5, night: 10 };
/** Version of the counted-hours defaults a label is up to date with (ShiftType.hoursRev). */
export const SHIFT_HOURS_REV = 2;

/** Length of a shift in hours from its times (a night ending the next day included). */
export function shiftDuration(s: { allDay: boolean; start: string; end: string }): number {
  if (s.allDay) return 0;
  const min = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
  let d = min(s.end) - min(s.start);
  if (d <= 0) d += 24 * 60;
  return d / 60;
}

/** Hours a shift label counts: the ones set on it, or its duration. */
export function countedHours(s: { allDay: boolean; start: string; end: string; hours?: number }): number {
  return typeof s.hours === 'number' ? s.hours : shiftDuration(s);
}

/** End date of a shift starting on `startDate`: the next day when it ends past midnight. */
export function shiftEndDate(startDate: DateKey, hours: ShiftHours): DateKey {
  return hours.end <= hours.start ? toDateKey(addDays(fromDateKey(startDate), 1)) : startDate;
}

/** The shift whose hours match exactly (to show it selected when editing). */
export function detectShift(start: string, end: string, hours: Record<ShiftId, ShiftHours>): ShiftId | null {
  return SHIFT_IDS.find((id) => hours[id].start === start && hours[id].end === end) ?? null;
}

/** Last day of the month of `date` (default end of "repeat these days"). */
export function endOfMonth(date: DateKey): DateKey {
  const d = fromDateKey(date);
  return toDateKey(addDays(addMonths(new Date(d.getFullYear(), d.getMonth(), 1), 1), -1));
}

/**
 * Short label for tight cells: an event titled with a shift's default title
 * ("Turno de tarde") shows just "Tarde"; any other title is kept.
 */
export function shortShiftTitle(title: string, t: (key: string, opts?: Record<string, string>) => string): string {
  for (const id of SHIFT_IDS) {
    const name = t(`calendars.shifts.names.${id}`);
    if (title === t('calendars.shifts.title', { shift: name.toLowerCase() })) return name;
  }
  return title;
}
