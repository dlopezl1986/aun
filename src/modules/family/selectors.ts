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

/** Age as years + months ("2 años y 4 meses"), for small children. */
export function ageParts(birthDate: DateKey, today: DateKey): { years: number; months: number } {
  const b = fromDateKey(birthDate);
  const now = fromDateKey(today);
  let months = (now.getFullYear() - b.getFullYear()) * 12 + now.getMonth() - b.getMonth();
  if (now.getDate() < b.getDate()) months -= 1;
  months = Math.max(0, months);
  return { years: Math.floor(months / 12), months: months % 12 };
}

const ZODIAC: { sign: string; emoji: string; from: [number, number] }[] = [
  { sign: 'capricorn', emoji: '♑', from: [1, 1] },
  { sign: 'aquarius', emoji: '♒', from: [1, 20] },
  { sign: 'pisces', emoji: '♓', from: [2, 19] },
  { sign: 'aries', emoji: '♈', from: [3, 21] },
  { sign: 'taurus', emoji: '♉', from: [4, 20] },
  { sign: 'gemini', emoji: '♊', from: [5, 21] },
  { sign: 'cancer', emoji: '♋', from: [6, 21] },
  { sign: 'leo', emoji: '♌', from: [7, 23] },
  { sign: 'virgo', emoji: '♍', from: [8, 23] },
  { sign: 'libra', emoji: '♎', from: [9, 23] },
  { sign: 'scorpio', emoji: '♏', from: [10, 23] },
  { sign: 'sagittarius', emoji: '♐', from: [11, 22] },
  { sign: 'capricorn', emoji: '♑', from: [12, 22] },
];

/** Western zodiac sign of a birth date. */
export function zodiacOf(birthDate: DateKey): { sign: string; emoji: string } {
  const d = fromDateKey(birthDate);
  const md = (d.getMonth() + 1) * 100 + d.getDate();
  let found = ZODIAC[0];
  for (const z of ZODIAC) if (md >= z.from[0] * 100 + z.from[1]) found = z;
  return { sign: found.sign, emoji: found.emoji };
}
