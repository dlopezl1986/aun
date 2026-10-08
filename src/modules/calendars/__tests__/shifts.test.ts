import { expandOccurrences } from '@/utils/recurrence';
import { combine, fromDateKey, toDateKey } from '@/utils/date';
import { eventTimes } from '../service';
import { DEFAULT_SHIFT_HOURS, detectShift, endOfMonth, shiftEndDate } from '../shifts';

describe('work shifts', () => {
  it('ends night shifts the next day and day shifts the same day', () => {
    expect(shiftEndDate('2026-10-31', DEFAULT_SHIFT_HOURS.night)).toBe('2026-11-01');
    expect(shiftEndDate('2026-10-08', DEFAULT_SHIFT_HOURS.afternoon)).toBe('2026-10-08');
  });

  it('recognises a shift from its hours', () => {
    expect(detectShift('15:00', '23:00', DEFAULT_SHIFT_HOURS)).toBe('afternoon');
    expect(detectShift('15:00', '22:00', DEFAULT_SHIFT_HOURS)).toBeNull();
    expect(detectShift('15:00', '22:00', { ...DEFAULT_SHIFT_HOURS, afternoon: { start: '15:00', end: '22:00' } })).toBe('afternoon');
  });

  it('finds the end of the month (leap years included)', () => {
    expect(endOfMonth('2026-10-08')).toBe('2026-10-31');
    expect(endOfMonth('2028-02-10')).toBe('2028-02-29');
    expect(endOfMonth('2026-12-01')).toBe('2026-12-31');
  });

  it('"afternoon shift Mon, Wed, Fri until end of month" lands on exactly those days', () => {
    const { start, end } = eventTimes({
      allDay: false,
      startDate: '2026-10-08',
      startTime: '15:00',
      endDate: '2026-10-08',
      endTime: '23:00',
    });
    const days = expandOccurrences({
      start,
      durationMs: end.getTime() - start.getTime(),
      rule: { freq: 'weekly', interval: 1, byWeekday: [0, 2, 4], until: endOfMonth('2026-10-08') },
      from: fromDateKey('2026-10-01'),
      to: fromDateKey('2026-12-01'),
    }).map(toDateKey);
    expect(days).toEqual([
      '2026-10-09',
      '2026-10-12',
      '2026-10-14',
      '2026-10-16',
      '2026-10-19',
      '2026-10-21',
      '2026-10-23',
      '2026-10-26',
      '2026-10-28',
      '2026-10-30',
    ]);
  });

  it('keeps night shifts 8 hours long across midnight', () => {
    const { start, end } = eventTimes({
      allDay: false,
      startDate: '2026-10-08',
      startTime: '23:00',
      endDate: '2026-10-09',
      endTime: '07:00',
    });
    expect(start).toEqual(combine('2026-10-08', '23:00'));
    expect(end.getTime() - start.getTime()).toBe(8 * 3600 * 1000);
  });
});
