import { allDayOn, layoutDay } from '../layout';
import type { Calendar, CalendarEvent, EventOccurrence } from '../types';

const cal = { id: 'c', name: 'Familia', color: '#000' } as Calendar;
const occ = (id: string, start: Date, end: Date, allDay = false): EventOccurrence => ({
  key: id,
  event: { id, title: id, allDay } as CalendarEvent,
  calendar: cal,
  start,
  end,
});
const at = (h: number, m = 0) => new Date(2026, 9, 7, h, m);

describe('day layout', () => {
  it('places non-overlapping events in a single column', () => {
    const r = layoutDay(at(0), [occ('a', at(9), at(10)), occ('b', at(10), at(11))]);
    expect(r.map((p) => [p.occurrence.key, p.column, p.columns])).toEqual([
      ['a', 0, 1],
      ['b', 0, 1],
    ]);
  });

  it('splits overlapping events side by side and reuses free columns', () => {
    const r = layoutDay(at(0), [occ('a', at(9), at(12)), occ('b', at(9, 30), at(10)), occ('c', at(10, 30), at(11))]);
    const byKey = Object.fromEntries(r.map((p) => [p.occurrence.key, p]));
    expect(byKey.a.column).toBe(0);
    expect(byKey.b.column).toBe(1);
    expect(byKey.c.column).toBe(1);
    expect(r.every((p) => p.columns === 2)).toBe(true);
  });

  it('clamps events crossing midnight and enforces a minimum height', () => {
    const r = layoutDay(at(0), [occ('late', at(23), new Date(2026, 9, 8, 2)), occ('zero', at(8), at(8))]);
    const byKey = Object.fromEntries(r.map((p) => [p.occurrence.key, p]));
    expect(byKey.late.endMin).toBe(1440);
    expect(byKey.zero.endMin - byKey.zero.startMin).toBe(20);
  });

  it('separates all-day events (including multi-day ones)', () => {
    const multi = occ('trip', new Date(2026, 9, 6), new Date(2026, 9, 9), true);
    expect(allDayOn(at(0), [multi, occ('a', at(9), at(10))]).map((o) => o.key)).toEqual(['trip']);
    expect(layoutDay(at(0), [multi])).toEqual([]);
  });
});
