import { fromDateKey, startOfDay, type DateKey } from '@/utils/date';
import type { Child } from './types';

export interface UpcomingBirthday {
  child: Child;
  date: Date;
  daysUntil: number;
  /** Age the child turns on that date. */
  turns: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Next birthday on/after `today` (handles 29 Feb → 28 Feb in non-leap years). */
export function nextBirthday(child: Child, today: DateKey): UpcomingBirthday | null {
  if (!child.birthDate) return null;
  const birth = fromDateKey(child.birthDate);
  const now = fromDateKey(today);
  const build = (year: number) => {
    const d = new Date(year, birth.getMonth(), birth.getDate());
    // 29 Feb in a non-leap year rolls into March: clamp to 28 Feb.
    if (d.getMonth() !== birth.getMonth()) return new Date(year, birth.getMonth() + 1, 0);
    return d;
  };
  let date = build(now.getFullYear());
  if (date < startOfDay(now)) date = build(now.getFullYear() + 1);
  const daysUntil = Math.round((date.getTime() - now.getTime()) / DAY_MS);
  return { child, date, daysUntil, turns: date.getFullYear() - birth.getFullYear() };
}

export function upcomingBirthdays(children: Child[], today: DateKey, withinDays = 90): UpcomingBirthday[] {
  return children
    .map((c) => nextBirthday(c, today))
    .filter((b): b is UpcomingBirthday => !!b && b.daysUntil <= withinDays)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

/** Age in whole years on `today`. */
export function ageFrom(birthDate: DateKey, today: DateKey): number {
  const b = fromDateKey(birthDate);
  const now = fromDateKey(today);
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age -= 1;
  return age;
}
