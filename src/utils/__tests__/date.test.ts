import { addDays, fromDateKey, monthMatrix, parseDateInput, parseTime, toDateKey } from '../date';

describe('date utils', () => {
  it('parses times in several formats and rejects invalid ones', () => {
    expect(parseTime('9:30')).toBe('09:30');
    expect(parseTime('0930')).toBe('09:30');
    expect(parseTime('18.05')).toBe('18:05');
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('ab')).toBeNull();
  });

  it('parses European and ISO dates and rejects impossible ones', () => {
    expect(parseDateInput('07/10/2026')).toBe('2026-10-07');
    expect(parseDateInput('7-3-2021')).toBe('2021-03-07');
    expect(parseDateInput('2026-02-28')).toBe('2026-02-28');
    expect(parseDateInput('31/02/2026')).toBeNull();
    expect(parseDateInput('hola')).toBeNull();
  });

  it('round-trips date keys without timezone drift', () => {
    expect(toDateKey(fromDateKey('2026-03-29'))).toBe('2026-03-29');
    expect(toDateKey(addDays(fromDateKey('2026-12-31'), 1))).toBe('2027-01-01');
  });

  it('builds a 6x7 month grid starting on Monday', () => {
    const grid = monthMatrix(new Date(2026, 9, 1)); // October 2026 starts on Thursday
    expect(grid).toHaveLength(6);
    expect(grid[0]).toHaveLength(7);
    expect(grid[0][0].getDay()).toBe(1);
    expect(toDateKey(grid[0][3])).toBe('2026-10-01');
  });
});
