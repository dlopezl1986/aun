import { createServices } from '@/services/container';
import { memoryStore } from '@/test/memoryStore';
import { combine, toDateKey, timeOf } from '@/utils/date';

// jest.mock factories run lazily and must use require().
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
let mockId = 0;
jest.mock('@/utils/id', () => ({ createId: () => `id-${++mockId}` }));

async function setup() {
  const s = createServices('u', memoryStore(), null);
  const cal = await s.calendars.createCalendar({ name: 'Soraya', color: '#EC4899' });
  return { s, calendarId: cal.id };
}
const days = async (s: Awaited<ReturnType<typeof setup>>['s'], title: string) =>
  (await s.calendars.occurrencesBetween(combine('2026-10-01'), combine('2026-11-15')))
    .filter((o) => o.event.title === title)
    .map((o) => `${toDateKey(o.start)} ${timeOf(o.start)}-${timeOf(o.end)}`);

describe('drag & drop moves', () => {
  it('moves a one-off event to another day keeping time and duration', async () => {
    const { s, calendarId } = await setup();
    const e = await s.calendars.createEvent({
      calendarId,
      title: 'Dentista',
      allDay: false,
      startDate: '2026-10-12',
      startTime: '10:00',
      endDate: '2026-10-12',
      endTime: '11:30',
    });
    await s.calendars.moveOccurrence(e.id, { from: '2026-10-12', to: '2026-10-15', scope: 'series' });
    expect(await days(s, 'Dentista')).toEqual(['2026-10-15 10:00-11:30']);
    // Hours view: new day AND time.
    await s.calendars.moveOccurrence(e.id, { from: '2026-10-15', to: '2026-10-14', toTime: '17:15', scope: 'series' });
    expect(await days(s, 'Dentista')).toEqual(['2026-10-14 17:15-18:45']);
  });

  it('moves only one day of a series: the series skips it and a single event replaces it', async () => {
    const { s, calendarId } = await setup();
    const e = await s.calendars.createEvent({
      calendarId,
      title: 'Tarde',
      allDay: false,
      startDate: '2026-10-12',
      startTime: '15:00',
      endDate: '2026-10-12',
      endTime: '23:00',
      recurrence: { freq: 'weekly', interval: 1, byWeekday: [0, 2], until: '2026-10-21' },
    });
    expect(await days(s, 'Tarde')).toEqual([
      '2026-10-12 15:00-23:00',
      '2026-10-14 15:00-23:00',
      '2026-10-19 15:00-23:00',
      '2026-10-21 15:00-23:00',
    ]);
    const single = await s.calendars.moveOccurrence(e.id, { from: '2026-10-14', to: '2026-10-16', scope: 'single' });
    expect(single.recurrence).toBeNull();
    expect(await days(s, 'Tarde')).toEqual([
      '2026-10-12 15:00-23:00',
      '2026-10-16 15:00-23:00',
      '2026-10-19 15:00-23:00',
      '2026-10-21 15:00-23:00',
    ]);
  });

  it('moves a whole series: weekdays, skipped days and the end date travel with it', async () => {
    const { s, calendarId } = await setup();
    const e = await s.calendars.createEvent({
      calendarId,
      title: 'Natación',
      allDay: false,
      startDate: '2026-10-12',
      startTime: '18:00',
      endDate: '2026-10-12',
      endTime: '19:00',
      recurrence: { freq: 'weekly', interval: 1, byWeekday: [0, 6], until: '2026-10-25' },
    });
    await s.calendars.deleteOccurrence(e.id, '2026-10-19');
    // Drag Monday 12 → Tuesday 13 (+1 day): Mon/Sun become Tue/Mon.
    const moved = await s.calendars.moveOccurrence(e.id, { from: '2026-10-12', to: '2026-10-13', scope: 'series' });
    expect(moved.recurrence?.byWeekday).toEqual([0, 1]);
    expect(moved.recurrence?.until).toBe('2026-10-26');
    expect(moved.exdates).toEqual(['2026-10-20']);
    expect(await days(s, 'Natación')).toEqual(['2026-10-13 18:00-19:00', '2026-10-19 18:00-19:00', '2026-10-26 18:00-19:00']);
  });

  it('keeps all-day events whole days long', async () => {
    const { s, calendarId } = await setup();
    const e = await s.calendars.createEvent({ calendarId, title: 'Viaje', allDay: true, startDate: '2026-10-09', endDate: '2026-10-11' });
    const moved = await s.calendars.moveOccurrence(e.id, { from: '2026-10-09', to: '2026-10-23', scope: 'series' });
    expect([toDateKey(new Date(moved.start)), toDateKey(new Date(moved.end))]).toEqual(['2026-10-23', '2026-10-26']);
  });

  it('moves a day note', async () => {
    const { s } = await setup();
    const n = await s.calendars.addDayNote({ date: '2026-10-09', text: 'Pediatra' });
    await s.calendars.moveDayNote(n.id, '2026-10-12');
    expect((await s.calendars.notesBetween('2026-10-12', '2026-10-12')).map((x) => x.text)).toEqual(['Pediatra']);
  });

  it('duplicates a calendar, empty or with all its events', async () => {
    const { s, calendarId } = await setup();
    await s.calendars.createEvent({
      calendarId,
      title: 'Tarde',
      allDay: false,
      startDate: '2026-10-12',
      startTime: '15:00',
      endDate: '2026-10-12',
      endTime: '23:00',
      color: '#8B5CF6',
      recurrence: { freq: 'weekly', interval: 1, byWeekday: [0, 2], until: '2026-10-21' },
    });
    const empty = await s.calendars.duplicateCalendar(calendarId, { withEvents: false, name: 'Soraya 2' });
    const full = await s.calendars.duplicateCalendar(calendarId, { withEvents: true, name: 'Soraya (copia)' });
    expect(empty).toMatchObject({ name: 'Soraya 2', color: '#EC4899' });
    const occ = await s.calendars.occurrencesBetween(combine('2026-10-01'), combine('2026-11-01'));
    const count = (id: string) => occ.filter((o) => o.calendar.id === id).length;
    expect([count(calendarId), count(empty.id), count(full.id)]).toEqual([4, 0, 4]);
    expect(occ.find((o) => o.calendar.id === full.id)?.event.color).toBe('#8B5CF6');
  });
});
