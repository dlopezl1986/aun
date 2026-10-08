import { addDays, startOfDay } from '@/utils/date';
import type { EventOccurrence } from './types';

export interface PositionedEvent {
  occurrence: EventOccurrence;
  /** Minutes from midnight (clamped to the day). */
  startMin: number;
  endMin: number;
  column: number;
  columns: number;
}

/**
 * Lays out the timed occurrences of ONE day: overlapping events share the
 * width side by side (greedy column assignment per overlap cluster).
 * Pure function — unit tested.
 */
export function layoutDay(day: Date, occurrences: EventOccurrence[], minDurationMin = 20): PositionedEvent[] {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = addDays(startOfDay(day), 1).getTime();
  const items = occurrences
    .filter((o) => !o.event.allDay && o.start.getTime() < dayEnd && o.end.getTime() > dayStart)
    .map((o) => {
      const startMin = Math.max(0, (o.start.getTime() - dayStart) / 60000);
      const endMin = Math.min(24 * 60, Math.max(startMin + minDurationMin, (o.end.getTime() - dayStart) / 60000));
      return { occurrence: o, startMin, endMin, column: 0, columns: 1 };
    })
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);

  let cluster: PositionedEvent[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const columns = Math.max(1, ...cluster.map((c) => c.column + 1));
    for (const c of cluster) c.columns = columns;
    cluster = [];
  };
  for (const item of items) {
    if (item.startMin >= clusterEnd) {
      flush();
      clusterEnd = -1;
    }
    const used = new Set(cluster.filter((c) => c.endMin > item.startMin).map((c) => c.column));
    let col = 0;
    while (used.has(col)) col += 1;
    item.column = col;
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.endMin);
  }
  flush();
  return items;
}

/** All-day (or multi-day) occurrences touching the day. */
export function allDayOn(day: Date, occurrences: EventOccurrence[]): EventOccurrence[] {
  const s = startOfDay(day).getTime();
  const e = addDays(startOfDay(day), 1).getTime();
  return occurrences.filter((o) => o.event.allDay && o.start.getTime() < e && o.end.getTime() > s);
}
