import { toDateKey, type DateKey } from '@/utils/date';
import type { Payment } from './types';

/**
 * Pure date maths for Pagos: when each payment falls due, what is pending,
 * and how much to set aside every month to afford the big ones.
 */

const pad = (n: number) => String(n).padStart(2, '0');
const cents = (n: number) => Math.round(n * 100) / 100;

/** Calendar months from a's month to b's month (2026-11-30 → 2027-01-01 = 2). */
export function monthsBetween(a: DateKey, b: DateKey): number {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return (by - ay) * 12 + (bm - am);
}

/** First day of the month of `key`. */
export const monthStart = (key: DateKey): DateKey => `${key.slice(0, 7)}-01`;

/** Last day of the month of `key`. */
export function monthEnd(key: DateKey): DateKey {
  const [y, m] = key.split('-').map(Number);
  return `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`;
}

/** Same day `months` months later (31 → last day of shorter months). */
export function addMonthsKey(key: DateKey, months: number): DateKey {
  const [y, m, d] = key.split('-').map(Number);
  const total = m - 1 + months;
  const year = y + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const days = new Date(year, month + 1, 0).getDate();
  return `${year}-${pad(month + 1)}-${pad(Math.min(d, days))}`;
}

/** Due date number `index` (0 = the first one). Always counted from the start, so days never drift. */
export const dueDateAt = (p: Pick<Payment, 'startDate' | 'everyMonths'>, index: number): DateKey =>
  index === 0 ? p.startDate : addMonthsKey(p.startDate, index * p.everyMonths);

/** How many payments there are in total; `null` = recurring with no end. */
export function paymentCount(p: Pick<Payment, 'startDate' | 'everyMonths' | 'endDate'>): number | null {
  if (!p.everyMonths) return 1;
  if (!p.endDate) return null;
  if (p.endDate < p.startDate) return 1;
  let n = Math.floor(monthsBetween(p.startDate, p.endDate) / p.everyMonths) + 1;
  while (n > 1 && dueDateAt(p, n - 1) > p.endDate) n--;
  return n;
}

/** Due date of the last payment ("10 cuotas" → its end date). */
export const lastDueDate = (p: Pick<Payment, 'startDate' | 'everyMonths'>, count: number): DateKey => dueDateAt(p, Math.max(0, count - 1));

/**
 * Recurring payments only count from the day they were added: earlier due
 * dates (last month's rent) are assumed handled, never "overdue".
 */
export function trackedFrom(p: Payment): DateKey {
  if (!p.everyMonths) return p.startDate;
  const created = toDateKey(new Date(p.createdAt));
  return created > p.startDate ? created : p.startDate;
}

export interface Occurrence {
  payment: Payment;
  date: DateKey;
  /** 0-based position in the series. */
  index: number;
  /** Payments in the series (`null` = no end). */
  total: number | null;
  paid: boolean;
}

/** Due dates of one payment between two days (both included). */
export function occurrencesBetween(p: Payment, from: DateKey, to: DateKey): Occurrence[] {
  const total = paymentCount(p);
  const first = trackedFrom(p);
  const lo = from > first ? from : first;
  if (lo > to) return [];
  const paid = new Set(p.paidDates);
  const out: Occurrence[] = [];
  const startIndex = p.everyMonths ? Math.max(0, Math.floor(monthsBetween(p.startDate, lo) / p.everyMonths) - 1) : 0;
  for (let i = startIndex; total === null || i < total; i++) {
    const date = dueDateAt(p, i);
    if (date > to) break;
    if (date >= lo) out.push({ payment: p, date, index: i, total, paid: paid.has(date) });
    if (!p.everyMonths) break;
  }
  return out;
}

const byDate = (a: Occurrence, b: Occurrence) => a.date.localeCompare(b.date) || a.payment.title.localeCompare(b.payment.title);

/** Every due date of every payment in a range, by date. */
export function allOccurrences(payments: Payment[], from: DateKey, to: DateKey): Occurrence[] {
  return payments.flatMap((p) => occurrencesBetween(p, from, to)).sort(byDate);
}

/** Unpaid due dates before today (up to a year back). */
export function overdue(payments: Payment[], today: DateKey): Occurrence[] {
  const yesterday = toDateKey(new Date(new Date(`${today}T12:00:00`).getTime() - 86_400_000));
  return allOccurrences(payments, addMonthsKey(today, -12), yesterday).filter((o) => !o.paid);
}

/** The next unpaid due date of a payment (overdue ones included); `null` when all are paid. */
export function nextUnpaid(p: Payment, today: DateKey): Occurrence | null {
  const late = occurrencesBetween(p, addMonthsKey(today, -12), today).find((o) => !o.paid);
  if (late) return late;
  // Ten years ahead is plenty for any real series.
  return occurrencesBetween(p, today, addMonthsKey(today, 120)).find((o) => !o.paid) ?? null;
}

export interface MonthSummary {
  total: number;
  paid: number;
  count: number;
  paidCount: number;
}

/** What falls due in the month of `day`, and how much of it is already paid. */
export function monthSummary(payments: Payment[], day: DateKey): MonthSummary {
  const all = allOccurrences(payments, monthStart(day), monthEnd(day));
  const paid = all.filter((o) => o.paid);
  return {
    total: cents(all.reduce((s, o) => s + o.payment.amount, 0)),
    paid: cents(paid.reduce((s, o) => s + o.payment.amount, 0)),
    count: all.length,
    paidCount: paid.length,
  };
}

export interface SavingGoal {
  payment: Payment;
  date: DateKey;
  amount: number;
  saved: number;
  remaining: number;
  /** Whole months left to save (0 = due this month). */
  months: number;
  /** Monthly quota: what was missing at the start of this month, split over the months left (rounded up). */
  perMonth: number;
  /** What is still to set aside this month (the quota minus what was saved this month). */
  leftThisMonth: number;
}

/**
 * Money to set aside: for every payment that is not monthly (one-off,
 * quarterly, yearly…), its next due date split over the months left.
 * Monthly ones are regular expenses, not something to save for.
 */
export function savingPlan(payments: Payment[], today: DateKey, horizonMonths = 24): SavingGoal[] {
  const out: SavingGoal[] = [];
  for (const p of payments) {
    if (p.everyMonths === 1 || p.amount <= 0) continue;
    const next = occurrencesBetween(p, today, addMonthsKey(today, horizonMonths)).find((o) => !o.paid);
    if (!next) continue;
    const saved = Math.max(0, p.saved || 0);
    const remaining = cents(Math.max(0, p.amount - saved));
    const months = monthsBetween(today, next.date);
    // The quota is fixed for the month: saving part of it now lowers what is left, not the quota.
    const savedNow = p.savedMonth === today.slice(0, 7) ? Math.min(saved, p.savedThisMonth ?? 0) : 0;
    const missingAtStart = Math.max(0, p.amount - (saved - savedNow));
    const perMonth = months >= 1 ? Math.min(remaining + savedNow, Math.ceil((missingAtStart / months) * 100) / 100) : remaining;
    const leftThisMonth = cents(Math.min(remaining, Math.max(0, perMonth - (months >= 1 ? savedNow : 0))));
    out.push({ payment: p, date: next.date, amount: p.amount, saved: cents(saved), remaining, months, perMonth, leftThisMonth });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Still to set aside this month for the payments to come (those due this month are counted in "Este mes"). */
export const monthlySaving = (plan: SavingGoal[]): number => cents(plan.reduce((s, g) => s + (g.months >= 1 ? g.leftThisMonth : 0), 0));

/** Average cost per month of the recurring payments still running. */
export function monthlyAverage(payments: Payment[], today: DateKey): number {
  return cents(
    payments.filter((p) => p.everyMonths > 0 && (!p.endDate || p.endDate >= today)).reduce((s, p) => s + p.amount / p.everyMonths, 0),
  );
}

/**
 * "12,50", "1.200", "1.200,50 €", "12.5" → number (Spanish style first).
 * Returns `null` when it is not a positive amount.
 */
export function parseAmount(input: string): number | null {
  let s = input.replace(/[€\s]/g, '');
  if (!s) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    const dec = lastComma > lastDot ? ',' : '.';
    s = s.replace(dec === ',' ? /\./g : /,/g, '').replace(dec, '.');
  } else if (lastComma >= 0) {
    // One comma = decimals ("12,50"); several = thousands ("1,200,000").
    s = s.indexOf(',') !== lastComma ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = cents(Number(s));
  return n > 0 ? n : null;
}
