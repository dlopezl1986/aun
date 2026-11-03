import type { TFunction } from 'i18next';

import { formatShortDate, fromDateKey, type DateKey } from '@/utils/date';
import { monthsBetween, nextUnpaid, paymentCount, type Occurrence } from './schedule';
import type { Payment } from './types';

/** "Cada mes", "Cada 3 meses", "Una vez"… */
export const frequencyLabel = (t: TFunction, everyMonths: number) =>
  [0, 1, 2, 3, 6, 12].includes(everyMonths) ? t(`payments.every.${everyMonths}`) : t('payments.everyN', { count: everyMonths });

/** Badge for one due date: "Único", "Cuota 3 de 10", "Cada mes"… */
export function occurrenceLabel(t: TFunction, o: Occurrence): string {
  if (!o.payment.everyMonths) return t('payments.once');
  if (o.total) return t('payments.instalment', { n: o.index + 1, total: o.total });
  return frequencyLabel(t, o.payment.everyMonths);
}

/** "Hoy", "Mañana", "En 5 días", "Hace 2 días". */
export function relativeDay(t: TFunction, date: DateKey, today: DateKey): string {
  const days = Math.round((fromDateKey(date).getTime() - fromDateKey(today).getTime()) / 86_400_000);
  if (days === 0) return t('common.today');
  if (days === 1) return t('common.tomorrow');
  if (days < 0) return t('payments.daysAgo', { count: -days });
  return t('payments.inDays', { count: days });
}

/** "en 4 meses" / "este mes". */
export const monthsLeftLabel = (t: TFunction, today: DateKey, date: DateKey) => {
  const m = monthsBetween(today, date);
  return m <= 0 ? t('payments.saving.thisMonth') : t('payments.saving.inMonths', { count: m });
};

/** One line describing the whole payment for the "Todos" list. */
export function scheduleLabel(t: TFunction, p: Payment, today: DateKey, locale: string): string {
  const short = (d: DateKey) => formatShortDate(fromDateKey(d), locale);
  if (!p.everyMonths) return `${t('payments.once')} · ${short(p.startDate)}`;
  const parts = [frequencyLabel(t, p.everyMonths)];
  const count = paymentCount(p);
  if (count && p.endDate) parts.push(t('payments.untilShort', { date: short(p.endDate), count }));
  const next = nextUnpaid(p, today);
  parts.push(next ? t('payments.nextShort', { date: short(next.date) }) : t('payments.finished'));
  return parts.join(' · ');
}
