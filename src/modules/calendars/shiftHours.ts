import { shiftDuration } from './shifts';
import type { EventOccurrence, ShiftType } from './types';

export interface ShiftTypeTotal {
  key: string;
  name: string;
  color: string;
  count: number;
  hours: number;
}

/** Shift hours of one calendar (one person) in a month. */
export interface ShiftCalendarTotal {
  calendarId: string;
  calendarName: string;
  calendarColor: string;
  count: number;
  hours: number;
  byType: ShiftTypeTotal[];
}

/**
 * Hours of the shifts painted in `month`, per calendar and per shift label.
 * Each shift counts the hours copied onto it when it was painted; older ones
 * use their label's hours (or their length).
 */
export function shiftTotals(occurrences: EventOccurrence[], types: ShiftType[], month: Date): ShiftCalendarTotal[] {
  const byCalendar = new Map<string, ShiftCalendarTotal>();
  for (const o of occurrences) {
    const e = o.event;
    if (!e.shiftTypeId) continue;
    if (o.start.getFullYear() !== month.getFullYear() || o.start.getMonth() !== month.getMonth()) continue;
    const type = types.find((t) => t.id === e.shiftTypeId);
    const hours =
      typeof e.shiftHours === 'number'
        ? e.shiftHours
        : type && typeof type.hours === 'number'
          ? type.hours
          : e.allDay
            ? 0
            : shiftDuration({ allDay: false, start: hhmm(o.start), end: hhmm(o.end) });
    const cal =
      byCalendar.get(o.calendar.id) ??
      byCalendar
        .set(o.calendar.id, {
          calendarId: o.calendar.id,
          calendarName: o.calendar.name,
          calendarColor: o.calendar.color,
          count: 0,
          hours: 0,
          byType: [],
        })
        .get(o.calendar.id)!;
    cal.count += 1;
    cal.hours += hours;
    let row = cal.byType.find((r) => r.key === e.shiftTypeId);
    if (!row) {
      row = { key: e.shiftTypeId, name: type?.name ?? e.title, color: type?.color ?? e.color ?? o.calendar.color, count: 0, hours: 0 };
      cal.byType.push(row);
    }
    row.count += 1;
    row.hours += hours;
  }
  const order = (key: string) => types.find((t) => t.id === key)?.order ?? 999;
  return [...byCalendar.values()]
    .map((c) => ({ ...c, byType: c.byType.sort((a, b) => order(a.key) - order(b.key)) }))
    .sort((a, b) => b.hours - a.hours);
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** "7,5 h" / "152 h" in the user's locale. */
export function formatHours(hours: number, locale: string): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(hours)} h`;
}
