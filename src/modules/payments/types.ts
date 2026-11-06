import type { BaseEntity } from '@/types/entity';
import type { DateKey } from '@/utils/date';

/**
 * Something the family has to pay: once (matrícula, ITV), every N months with
 * no end (alquiler, seguro anual) or every N months between two dates
 * (préstamo, 10 cuotas del comedor).
 */
export interface Payment extends BaseEntity {
  title: string;
  /** Amount of each payment, in euros. */
  amount: number;
  /** 0 = one-off; otherwise every N months (1 monthly, 3 quarterly, 12 yearly…). */
  everyMonths: number;
  /** First (or only) due date. Later ones keep its day of the month. */
  startDate: DateKey;
  /** Recurring: last possible due date (`null` = no end). */
  endDate?: DateKey | null;
  /** Built-in category (see PAYMENT_CATEGORIES). */
  categoryId: string;
  notes?: string | null;
  /**
   * Only its owner sees it (stored outside the family space). Missing/false =
   * shared with the family, like before.
   */
  private?: boolean;
  /** Due dates already paid. */
  paidDates: DateKey[];
  /** Money already set aside for the next unpaid due date. */
  saved: number;
  /** Month ("2026-11") of the last saving, and how much of `saved` went in that month. */
  savedMonth?: string | null;
  savedThisMonth?: number;
}

export interface PaymentCategory {
  id: string;
  emoji: string;
  color: string;
}

export const PAYMENT_CATEGORIES: PaymentCategory[] = [
  { id: 'home', emoji: '🏠', color: '#2563EB' },
  { id: 'utilities', emoji: '💡', color: '#CA8A04' },
  { id: 'insurance', emoji: '🛡️', color: '#0D9488' },
  { id: 'school', emoji: '🎒', color: '#7C3AED' },
  { id: 'taxes', emoji: '🧾', color: '#A16207' },
  { id: 'loans', emoji: '🏦', color: '#475569' },
  { id: 'car', emoji: '🚗', color: '#0284C7' },
  { id: 'health', emoji: '💊', color: '#16A34A' },
  { id: 'subscriptions', emoji: '📺', color: '#DB2777' },
  { id: 'leisure', emoji: '🎉', color: '#EA580C' },
  { id: 'other', emoji: '📦', color: '#64748B' },
];

export const categoryOf = (id: string | null | undefined): PaymentCategory =>
  PAYMENT_CATEGORIES.find((c) => c.id === id) ?? PAYMENT_CATEGORIES[PAYMENT_CATEGORIES.length - 1];

/** Repeat options offered in the form (months; 0 = once). */
export const FREQUENCIES = [0, 1, 2, 3, 6, 12] as const;
