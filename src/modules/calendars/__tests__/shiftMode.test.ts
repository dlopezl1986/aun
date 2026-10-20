import { createServices } from '@/services/container';
import { memoryStore } from '@/test/memoryStore';
import { shiftTotals } from '../shiftHours';

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

describe('shift hours', () => {
  it('the usual shifts count 7.5 h (morning, afternoon) and 10 h (night); a day off 0', async () => {
    const { byName } = await setup();
    expect(byName('Mañana').hours).toBe(7.5);
    expect(byName('Tarde').hours).toBe(7.5);
    expect(byName('Noche').hours).toBe(10);
    expect(byName('Libre').hours).toBe(0);
  });

  it('labels made before hours existed get them (usual ones their usual hours, the rest their length)', async () => {
    const s = createServices('u', memoryStore(), null);
    const repo = s.collections.get('shiftTypes')!;
    await repo.create({ name: 'Noche', color: '#000', allDay: false, start: '23:00', end: '07:00', order: 0 } as never);
    await repo.create({ name: 'Guardia', color: '#000', allDay: false, start: '08:00', end: '20:00', order: 1 } as never);
    const types = await s.shiftTypes.ensureDefaults(names);
    expect(types.map((t) => [t.name, t.hours])).toEqual([
      ['Noche', 10],
      ['Guardia', 12],
    ]);
  });

  it('each painted shift keeps its hours, and the month adds them up per calendar and per shift', async () => {
    const { s, cal, byName } = await setup();
    for (const d of ['2026-11-02', '2026-11-03']) await s.calendars.paintShift(byName('Mañana'), cal.id, d);
    await s.calendars.paintShift(byName('Noche'), cal.id, '2026-11-04');
    await s.calendars.paintShift(byName('Libre'), cal.id, '2026-11-05');
    await s.calendars.paintShift(byName('Mañana'), cal.id, '2026-12-01'); // another month
    // Changing the label later does not change shifts already painted.
    await s.shiftTypes.update(byName('Mañana').id, { ...byName('Mañana'), hours: 8 });
    const occ = await s.calendars.occurrencesBetween(new Date('2026-10-26T00:00'), new Date('2026-12-07T00:00'));
    const [total] = shiftTotals(occ, await s.shiftTypes.list(), new Date(2026, 10, 1));
    expect(total).toMatchObject({ calendarName: 'Trabajo', count: 4, hours: 25 });
    expect(total.byType.map((r) => [r.name, r.count, r.hours])).toEqual([
      ['Mañana', 2, 15],
      ['Noche', 1, 10],
      ['Libre', 1, 0],
    ]);
  });
});
