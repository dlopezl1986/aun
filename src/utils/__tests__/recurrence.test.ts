import { toDateKey } from '../date';
import { expandOccurrences } from '../recurrence';

const HOUR = 60 * 60 * 1000;
const keys = (dates: Date[]) => dates.map(toDateKey);

describe('expandOccurrences', () => {
  const start = new Date(2026, 9, 5, 17, 30); // Mon 5 Oct 2026 17:30

  it('returns the single event when there is no rule', () => {
    expect(keys(expandOccurrences({ start, durationMs: HOUR, from: new Date(2026, 9, 1), to: new Date(2026, 9, 31) }))).toEqual([
      '2026-10-05',
    ]);
    expect(expandOccurrences({ start, durationMs: HOUR, from: new Date(2026, 10, 1), to: new Date(2026, 10, 30) })).toEqual([]);
  });

  it('daily with interval, keeping the time of day', () => {
    const r = expandOccurrences({
      start,
      durationMs: HOUR,
      rule: { freq: 'daily', interval: 2 },
      from: new Date(2026, 9, 5),
      to: new Date(2026, 9, 12),
    });
    expect(keys(r)).toEqual(['2026-10-05', '2026-10-07', '2026-10-09', '2026-10-11']);
    expect(r.every((d) => d.getHours() === 17 && d.getMinutes() === 30)).toBe(true);
  });

  it('weekly on several weekdays (Mon/Wed/Fri) with exclusions', () => {
    const r = expandOccurrences({
      start,
      durationMs: HOUR,
      rule: { freq: 'weekly', interval: 1, byWeekday: [0, 2, 4] },
      from: new Date(2026, 9, 1),
      to: new Date(2026, 9, 17),
      exdates: ['2026-10-07'],
    });
    expect(keys(r)).toEqual(['2026-10-05', '2026-10-09', '2026-10-12', '2026-10-14', '2026-10-16']);
  });

  it('every two weeks, starting far in the past (skips ahead efficiently)', () => {
    const old = new Date(2020, 0, 6, 9, 0); // Monday
    const r = expandOccurrences({
      start: old,
      durationMs: HOUR,
      rule: { freq: 'weekly', interval: 2 },
      from: new Date(2026, 9, 1),
      to: new Date(2026, 10, 1),
    });
    expect(r.length).toBeGreaterThanOrEqual(2);
    expect(r.every((d) => d.getDay() === 1)).toBe(true);
    const diff = (r[1].getTime() - r[0].getTime()) / (24 * HOUR);
    expect(Math.round(diff)).toBe(14);
  });

  it('monthly skips months without that day; yearly skips 29 Feb in non-leap years', () => {
    const m = expandOccurrences({
      start: new Date(2026, 0, 31, 10),
      durationMs: HOUR,
      rule: { freq: 'monthly', interval: 1 },
      from: new Date(2026, 0, 1),
      to: new Date(2026, 5, 1),
    });
    expect(keys(m)).toEqual(['2026-01-31', '2026-03-31', '2026-05-31']);
    const y = expandOccurrences({
      start: new Date(2024, 1, 29, 10),
      durationMs: HOUR,
      rule: { freq: 'yearly', interval: 1 },
      from: new Date(2024, 0, 1),
      to: new Date(2029, 0, 1),
    });
    expect(keys(y)).toEqual(['2024-02-29', '2028-02-29']);
  });

  it('honours COUNT (exclusions still count) and UNTIL (inclusive)', () => {
    const c = expandOccurrences({
      start,
      durationMs: HOUR,
      rule: { freq: 'daily', interval: 1, count: 3 },
      from: new Date(2026, 9, 1),
      to: new Date(2026, 11, 1),
      exdates: ['2026-10-06'],
    });
    expect(keys(c)).toEqual(['2026-10-05', '2026-10-07']);
    const u = expandOccurrences({
      start,
      durationMs: HOUR,
      rule: { freq: 'daily', interval: 1, until: '2026-10-07' },
      from: new Date(2026, 9, 1),
      to: new Date(2026, 11, 1),
    });
    expect(keys(u)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07']);
  });

  it('includes an occurrence that started before the window but is still running', () => {
    const r = expandOccurrences({
      start: new Date(2026, 9, 5, 23),
      durationMs: 3 * HOUR,
      rule: { freq: 'daily', interval: 1 },
      from: new Date(2026, 9, 7),
      to: new Date(2026, 9, 8),
    });
    expect(keys(r)).toEqual(['2026-10-06', '2026-10-07']);
  });
});
