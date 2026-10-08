import type { RecurrenceRule } from '@/types/recurrence';
import { fromDateKey, toDateKey, type DateKey } from './date';

/**
 * Expands a recurring item into occurrence start dates (RFC 5545 semantics,
 * subset): DAILY / WEEKLY (BYDAY) / MONTHLY (by month day) / YEARLY, with
 * INTERVAL, UNTIL (inclusive day), COUNT and excluded dates (EXDATE).
 *
 * Shared by events, tasks and reminders. Pure and timezone-safe: dates are
 * rebuilt from local components so the time of day survives DST changes.
 */
export interface ExpandOptions {
  /** First occurrence (also defines time of day, weekday and month day). */
  start: Date;
  /** Occurrence length, used to include occurrences that overlap `from`. */
  durationMs: number;
  rule?: RecurrenceRule | null;
  from: Date;
  to: Date;
  exdates?: Iterable<DateKey>;
  /** Safety cap on generated occurrences. */
  limit?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function at(base: Date, y: number, m: number, d: number): Date {
  return new Date(y, m, d, base.getHours(), base.getMinutes(), base.getSeconds(), base.getMilliseconds());
}

/** Monday-based weekday: 0 = Monday … 6 = Sunday. */
export function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function expandOccurrences({ start, durationMs, rule, from, to, exdates, limit = 1000 }: ExpandOptions): Date[] {
  const overlaps = (s: Date) => s < to && s.getTime() + Math.max(durationMs, 1) > from.getTime();
  if (!rule) return overlaps(start) ? [start] : [];

  const excluded = new Set(exdates ?? []);
  const interval = Math.max(1, Math.floor(rule.interval || 1));
  const untilEnd = rule.until ? fromDateKey(rule.until.slice(0, 10)).getTime() + DAY_MS : Infinity;
  const maxCount = rule.count && rule.count > 0 ? rule.count : Infinity;
  const result: Date[] = [];
  let generated = 0;

  /** Returns false when iteration must stop. */
  const emit = (s: Date): boolean => {
    if (s < start) return true;
    if (s.getTime() >= untilEnd || generated >= maxCount) return false;
    generated += 1;
    if (s >= to) return false;
    if (overlaps(s) && !excluded.has(toDateKey(s))) result.push(s);
    return result.length < limit;
  };

  // Without COUNT we can jump close to the window instead of walking from the start.
  const canSkip = maxCount === Infinity;
  const windowStart = from.getTime() - durationMs;

  switch (rule.freq) {
    case 'daily': {
      let i = canSkip ? Math.max(0, Math.floor((windowStart - start.getTime()) / (interval * DAY_MS)) - 1) : 0;
      for (; ; i += 1) {
        if (!emit(at(start, start.getFullYear(), start.getMonth(), start.getDate() + i * interval))) break;
      }
      break;
    }
    case 'weekly': {
      const days = (rule.byWeekday?.length ? [...new Set(rule.byWeekday)] : [mondayIndex(start)]).sort((a, b) => a - b);
      const weekStart = at(start, start.getFullYear(), start.getMonth(), start.getDate() - mondayIndex(start));
      let w = canSkip ? Math.max(0, Math.floor((windowStart - weekStart.getTime()) / (interval * 7 * DAY_MS)) - 1) : 0;
      outer: for (; ; w += 1) {
        for (const d of days) {
          const s = at(start, weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + w * interval * 7 + d);
          if (!emit(s)) break outer;
        }
      }
      break;
    }
    case 'monthly': {
      const day = start.getDate();
      for (let i = 0; i < 12 * 200; i += 1) {
        const y = start.getFullYear() + Math.floor((start.getMonth() + i * interval) / 12);
        const m = (start.getMonth() + i * interval) % 12;
        const s = at(start, y, m, day);
        if (s.getMonth() !== m) continue; // e.g. 31st in a 30-day month: skipped (RFC 5545)
        if (!emit(s)) break;
      }
      break;
    }
    case 'yearly': {
      for (let i = 0; i < 400; i += 1) {
        const s = at(start, start.getFullYear() + i * interval, start.getMonth(), start.getDate());
        if (s.getMonth() !== start.getMonth()) continue; // 29 Feb on non-leap years: skipped
        if (!emit(s)) break;
      }
      break;
    }
  }
  return result;
}
