/**
 * Date helpers. Calendar days are represented as local "date keys"
 * (YYYY-MM-DD) to avoid timezone drift for all-day items and due dates.
 */
export type DateKey = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

export function addMonths(d: Date, months: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + months, 1);
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function todayKey(now = new Date()): DateKey {
  return toDateKey(now);
}

export function tomorrowKey(now = new Date()): DateKey {
  return toDateKey(addDays(now, 1));
}

export function isSameDay(a: Date, b: Date): boolean {
  return toDateKey(a) === toDateKey(b);
}

/** Combines a date key and "HH:mm" into a local Date. */
export function combine(key: DateKey, time?: string | null): Date {
  const d = fromDateKey(key);
  if (time) {
    const [h, m] = time.split(':').map(Number);
    d.setHours(h, m, 0, 0);
  }
  return d;
}

export function timeOf(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parses "HH:mm" or "H:mm" (also "930" / "0930"). Returns null when invalid. */
export function parseTime(input: string): string | null {
  const v = input.trim();
  const m = /^(\d{1,2})[:.h]?(\d{2})$/.exec(v);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${pad(h)}:${pad(min)}`;
}

/** Parses "DD/MM/YYYY", "D/M/YYYY" or "YYYY-MM-DD". Returns null when invalid. */
export function parseDateInput(input: string): DateKey | null {
  const v = input.trim();
  let y: number, mo: number, d: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v);
  const eu = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v);
  if (iso) [y, mo, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (eu) [d, mo, y] = [Number(eu[1]), Number(eu[2]), Number(eu[3])];
  else return null;
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return toDateKey(date);
}

export function formatDateInput(key: DateKey): string {
  const d = fromDateKey(key);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// ---------- Localised formatting (Intl is available in Hermes and browsers) ----------

export function formatLongDate(d: Date, locale: string): string {
  const s = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatShortDate(d: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(d);
}

export function formatMonthYear(d: Date, locale: string): string {
  const s = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatTime(d: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(d);
}

/** Short weekday names starting on Monday. */
export function weekdayNames(locale: string): string[] {
  const monday = new Date(2024, 0, 1); // a Monday
  return Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(addDays(monday, i)).replace('.', ''),
  );
}

/** 6×7 matrix of dates for a month grid, weeks starting on Monday. */
export function monthMatrix(month: Date): Date[][] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = addDays(first, -offset);
  return Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
}

export function greetingKey(now = new Date()): 'morning' | 'afternoon' | 'evening' {
  const h = now.getHours();
  if (h < 13) return 'morning';
  if (h < 20) return 'afternoon';
  return 'evening';
}
