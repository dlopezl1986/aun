import { createServices } from '@/services/container';
import { memoryStore } from '@/test/memoryStore';

// jest.mock factories run lazily and must use require().
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
let mockId = 0;
jest.mock('@/utils/id', () => ({ createId: () => `id-${++mockId}` }));

const names = { morning: 'Mañana', afternoon: 'Tarde', night: 'Noche', off: 'Libre' };

async function setup() {
  const s = createServices('u', memoryStore(), null);
  const cal = await s.calendars.createCalendar({ name: 'Trabajo', color: '#2563EB' });
  const types = await s.shiftTypes.ensureDefaults(names, { hours: { morning: { start: '06:00', end: '14:00' } } });
  const byName = (n: string) => types.find((t) => t.name === n)!;
  return { s, cal, byName };
}

describe('shift mode', () => {
  it('starts with Mañana, Tarde, Noche and Libre (keeping the hours already used), only once', async () => {
    const { s, byName } = await setup();
    expect((await s.shiftTypes.list()).map((t) => t.name)).toEqual(['Mañana', 'Tarde', 'Noche', 'Libre']);
    expect(byName('Mañana')).toMatchObject({ start: '06:00', end: '14:00', allDay: false });
    expect(byName('Libre').allDay).toBe(true);
    await s.shiftTypes.ensureDefaults(names);
    expect(await s.shiftTypes.list()).toHaveLength(4);
  });

  it('tapping a day adds the shift with its hours and colour; tapping again removes it', async () => {
    const { s, cal, byName } = await setup();
    const change = await s.calendars.paintShift(byName('Mañana'), cal.id, '2026-11-02');
    expect(change.added[0]).toMatchObject({ title: 'Mañana', color: byName('Mañana').color, shiftTypeId: byName('Mañana').id });
    expect(new Date(change.added[0].start).getHours()).toBe(6);
    expect(new Date(change.added[0].end).getHours()).toBe(14);
    const again = await s.calendars.paintShift(byName('Mañana'), cal.id, '2026-11-02');
    expect(again.removed).toHaveLength(1);
  });

  it('a night shift ends the next morning; a day off is all day', async () => {
    const { s, cal, byName } = await setup();
    const night = (await s.calendars.paintShift(byName('Noche'), cal.id, '2026-11-03')).added[0];
    expect(night.start.slice(0, 10) <= '2026-11-03').toBe(true);
    expect(new Date(night.end).getDate()).toBe(4);
    const off = (await s.calendars.paintShift(byName('Libre'), cal.id, '2026-11-05')).added[0];
    expect(off.allDay).toBe(true);
  });

  it('the eraser removes the shifts of that day (only shifts, only that calendar), and undo brings them back', async () => {
    const { s, cal, byName } = await setup();
    const other = await s.calendars.createCalendar({ name: 'Casa', color: '#f00' });
    await s.calendars.paintShift(byName('Mañana'), cal.id, '2026-11-02');
    await s.calendars.paintShift(byName('Tarde'), cal.id, '2026-11-02');
    await s.calendars.paintShift(byName('Mañana'), other.id, '2026-11-02');
    await s.calendars.createEvent({ calendarId: cal.id, title: 'Médico', allDay: false, startDate: '2026-11-02', startTime: '18:00' });
    const erased = await s.calendars.eraseShifts(cal.id, '2026-11-02');
    expect(erased.removed.map((e) => e.title).sort()).toEqual(['Mañana', 'Tarde']);
    const left = (await s.calendars.occurrencesBetween(new Date('2026-11-02T00:00'), new Date('2026-11-03T00:00'))).map(
      (o) => `${o.calendar.name}:${o.event.title}`,
    );
    expect(left.sort()).toEqual(['Casa:Mañana', 'Trabajo:Médico']);
    await s.calendars.undoShiftChange(erased);
    const back = await s.calendars.occurrencesBetween(new Date('2026-11-02T00:00'), new Date('2026-11-03T00:00'));
    expect(back).toHaveLength(4);
  });
});
