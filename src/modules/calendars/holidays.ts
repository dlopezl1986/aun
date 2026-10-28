import { addDays, toDateKey, type DateKey } from '@/utils/date';
import type { Calendar, EventOccurrence } from './types';

/**
 * Public holidays in the Comunidad de Madrid: the national ones plus the
 * region's own (and the days the region moves them to), exactly as in each
 * year's official decree. Local holidays of each town are not included.
 *
 * Sources:
 *   2026 — Decreto 75/2025 (BOCM 25-09-2025)
 *   2027 — Decreto 82/2026 (BOCM 01-10-2026)
 * Add the next year when its decree is published (each autumn).
 */
const HOLIDAYS: Record<DateKey, string> = {
  // 2026
  '2026-01-01': 'Año Nuevo',
  '2026-01-06': 'Epifanía del Señor',
  '2026-04-02': 'Jueves Santo',
  '2026-04-03': 'Viernes Santo',
  '2026-05-01': 'Fiesta del Trabajo',
  '2026-05-02': 'Fiesta de la Comunidad de Madrid',
  '2026-08-15': 'Asunción de la Virgen',
  '2026-10-12': 'Fiesta Nacional de España',
  '2026-11-02': 'Todos los Santos (traslado)',
  '2026-12-07': 'Día de la Constitución (traslado)',
  '2026-12-08': 'Inmaculada Concepción',
  '2026-12-25': 'Navidad',
  // 2027
  '2027-01-01': 'Año Nuevo',
  '2027-01-06': 'Epifanía del Señor',
  '2027-03-19': 'San José',
  '2027-03-25': 'Jueves Santo',
  '2027-03-26': 'Viernes Santo',
  '2027-05-01': 'Fiesta del Trabajo',
  '2027-08-16': 'Asunción de la Virgen (traslado)',
  '2027-10-12': 'Fiesta Nacional de España',
  '2027-11-01': 'Todos los Santos',
  '2027-12-06': 'Día de la Constitución',
  '2027-12-08': 'Inmaculada Concepción',
  '2027-12-25': 'Navidad',
};

/** Light red of holidays on the calendar. */
export const HOLIDAY_COLOR = '#F87171';
/** Id of the (virtual, read-only) holidays calendar. */
export const HOLIDAYS_CALENDAR_ID = 'aun-holidays';

export const holidayOn = (date: DateKey): string | null => HOLIDAYS[date] ?? null;

/** Holidays in `days` days from `from`: date → name. */
export function holidaysBetween(from: Date, days: number): Map<DateKey, string> {
  const map = new Map<DateKey, string>();
  for (let i = 0; i < days; i++) {
    const key = toDateKey(addDays(from, i));
    const name = HOLIDAYS[key];
    if (name) map.set(key, name);
  }
  return map;
}

export const isHoliday = (o: Pick<EventOccurrence, 'calendar'>) => o.calendar.id === HOLIDAYS_CALENDAR_ID;

/** Holidays as all-day occurrences of a read-only "Festivos" calendar, so every view shows them. */
export function holidayOccurrences(holidays: Map<DateKey, string>, calendarName: string): EventOccurrence[] {
  const calendar: Calendar = {
    id: HOLIDAYS_CALENDAR_ID,
    ownerId: '',
    createdAt: '',
    updatedAt: '',
    name: calendarName,
    color: HOLIDAY_COLOR,
    icon: 'flag',
    isActive: true,
    isVisible: true,
    order: -1,
  };
  return [...holidays].map(([date, name]) => {
    const start = new Date(`${date}T00:00:00`);
    const end = addDays(start, 1);
    return {
      key: `holiday:${date}`,
      calendar,
      start,
      end,
      event: {
        id: `holiday-${date}`,
        ownerId: '',
        createdAt: '',
        updatedAt: '',
        calendarId: HOLIDAYS_CALENDAR_ID,
        title: name,
        start: start.toISOString(),
        end: end.toISOString(),
        allDay: true,
        participants: [],
        reminders: [],
      },
    };
  });
}
