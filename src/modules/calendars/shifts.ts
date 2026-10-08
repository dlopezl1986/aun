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
