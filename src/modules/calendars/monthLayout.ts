import { toDateKey } from '@/utils/date';
import type { EventOccurrence } from './types';

/** A multi-day event drawn as one bar across the days of a week row. */
export interface WeekBar {
  occurrence: EventOccurrence;
  /** First column (0 = Monday) and number of days covered in this week. */
  col: number;
  span: number;
  /** Row inside the week (bars never overlap). */
  lane: number;
  /** The event really starts / ends in this week (rounded ends; otherwise it continues). */
  startsHere: boolean;
  endsHere: boolean;
}

/** Last day an occurrence touches (an end at 00:00 belongs to the day before). */
export function lastDayKey(o: Pick<EventOccurrence, 'start' | 'end'>): string {
  const end = o.end.getTime() > o.start.getTime() ? new Date(o.end.getTime() - 1) : o.start;
  return toDateKey(end);
}

/** Does the occurrence cover more than one calendar day? */
export const isMultiDay = (o: Pick<EventOccurrence, 'start' | 'end'>) => lastDayKey(o) > toDateKey(o.start);

/**
 * Lays out one week row of the month grid: multi-day events become bars in
 * lanes (longest first, so they stay on top and continuous); the rest stay
 * as labels in their day. `week` holds the 7 days, Monday first.
 */
export function layoutWeek(
  occurrences: EventOccurrence[],
  week: Date[],
  /** Week view's all-day row: one-day events are bars too (span 1). */
  opts: { allAsBars?: boolean } = {},
): { bars: WeekBar[]; lanes: number; singles: Map<string, EventOccurrence[]> } {
  const keys = week.map(toDateKey);
  const first = keys[0];
  const last = keys[keys.length - 1];
  const singles = new Map<string, EventOccurrence[]>();
  const spanning: { o: EventOccurrence; col: number; end: number; startsHere: boolean; endsHere: boolean }[] = [];

  for (const o of occurrences) {
    const startKey = toDateKey(o.start);
    const endKey = lastDayKey(o);
    if (endKey < first || startKey > last) continue;
    if (startKey === endKey && !opts.allAsBars) {
      singles.set(startKey, [...(singles.get(startKey) ?? []), o]);
      continue;
    }
    const col = startKey < first ? 0 : keys.indexOf(startKey);
    const end = endKey > last ? keys.length - 1 : keys.indexOf(endKey);
    spanning.push({ o, col, end, startsHere: startKey >= first, endsHere: endKey <= last });
  }

  // Longest first (then earliest): each bar takes the first lane free for all its days.
  spanning.sort((a, b) => b.end - b.col - (a.end - a.col) || a.col - b.col || a.o.start.getTime() - b.o.start.getTime());
  const taken: boolean[][] = [];
  const bars: WeekBar[] = spanning.map((s) => {
    let lane = 0;
    while (taken[lane]?.slice(s.col, s.end + 1).some(Boolean)) lane += 1;
    taken[lane] ??= Array(keys.length).fill(false);
    for (let c = s.col; c <= s.end; c++) taken[lane][c] = true;
    return { occurrence: s.o, col: s.col, span: s.end - s.col + 1, lane, startsHere: s.startsHere, endsHere: s.endsHere };
  });
  return { bars, lanes: taken.length, singles };
}
