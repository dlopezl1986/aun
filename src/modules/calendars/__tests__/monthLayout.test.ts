import { isMultiDay, lastDayKey, layoutWeek } from '../monthLayout';
import type { EventOccurrence } from '../types';

const occ = (id: string, start: string, end: string): EventOccurrence =>
  ({
    key: id,
    start: new Date(start),
    end: new Date(end),
    event: { id, title: id },
    calendar: { id: 'c', color: '#f00' },
  }) as unknown as EventOccurrence;
// Week of Monday 19 Oct 2026.
const week = Array.from({ length: 7 }, (_, i) => new Date(2026, 9, 19 + i));

describe('multi-day events in the month grid', () => {
  it('knows the last day an event touches (all-day ends are exclusive)', () => {
    expect(lastDayKey(occ('a', '2026-10-19T00:00', '2026-10-22T00:00'))).toBe('2026-10-21');
    expect(lastDayKey(occ('t', '2026-10-19T10:00', '2026-10-21T12:00'))).toBe('2026-10-21');
    expect(isMultiDay(occ('one', '2026-10-19T10:00', '2026-10-19T11:00'))).toBe(false);
    expect(isMultiDay(occ('allday', '2026-10-19T00:00', '2026-10-20T00:00'))).toBe(false);
  });

  it('a Monday→Wednesday event is one bar over 3 days; one-day events stay in their day', () => {
    const { bars, lanes, singles } = layoutWeek(
      [occ('trip', '2026-10-19T00:00', '2026-10-22T00:00'), occ('dentist', '2026-10-20T10:00', '2026-10-20T11:00')],
      week,
    );
    expect(bars).toEqual([expect.objectContaining({ col: 0, span: 3, lane: 0, startsHere: true, endsHere: true })]);
    expect(lanes).toBe(1);
    expect(singles.get('2026-10-20')?.map((o) => o.key)).toEqual(['dentist']);
  });

  it('events that cross into the next week are cut at the week edges (and continue)', () => {
    const { bars } = layoutWeek([occ('holidays', '2026-10-16T00:00', '2026-10-28T00:00')], week);
    expect(bars[0]).toEqual(expect.objectContaining({ col: 0, span: 7, startsHere: false, endsHere: false }));
    const next = layoutWeek([occ('holidays', '2026-10-24T00:00', '2026-10-28T00:00')], week).bars[0];
    expect(next).toEqual(expect.objectContaining({ col: 5, span: 2, startsHere: true, endsHere: false }));
  });

  it('overlapping bars go to different rows; free rows are reused', () => {
    const { bars, lanes } = layoutWeek(
      [
        occ('a', '2026-10-19T00:00', '2026-10-22T00:00'), // Mon–Wed
        occ('b', '2026-10-20T00:00', '2026-10-23T00:00'), // Tue–Thu
        occ('c', '2026-10-23T00:00', '2026-10-25T00:00'), // Fri–Sat
      ],
      week,
    );
    const lane = Object.fromEntries(bars.map((b) => [b.occurrence.key, b.lane]));
    expect(lane.a).not.toBe(lane.b);
    expect(lane.c).toBe(0);
    expect(lanes).toBe(2);
  });

  it('in the week view all-day row, one-day events are bars as well', () => {
    const { bars, singles } = layoutWeek([occ('fiesta', '2026-10-21T00:00', '2026-10-22T00:00')], week, { allAsBars: true });
    expect(singles.size).toBe(0);
    expect(bars[0]).toEqual(expect.objectContaining({ col: 2, span: 1, startsHere: true, endsHere: true }));
  });
});
