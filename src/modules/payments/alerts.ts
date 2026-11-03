import type { AlertItem, AlertSource } from '@/types/module';
import { combine, formatShortDate, fromDateKey, toDateKey } from '@/utils/date';
import { paymentsMeta } from './meta';
import { allOccurrences } from './schedule';

const DAYS_BEFORE = 3;

/** Unpaid due dates: three days before and on the day, at 09:00. */
export const paymentAlertSource: AlertSource = {
  id: 'payments.due',
  labelKey: 'notifications.sources.payments',
  descriptionKey: 'notifications.sources.paymentsHint',
  icon: 'credit-card',
  async list(services, ctx) {
    const out: AlertItem[] = [];
    const from = toDateKey(ctx.from);
    const to = toDateKey(new Date(ctx.to.getTime() + DAYS_BEFORE * 86_400_000));
    const amount = (n: number) => new Intl.NumberFormat(ctx.locale, { style: 'currency', currency: 'EUR' }).format(n);
    for (const o of allOccurrences(await services.payments.list(), from, to)) {
      if (o.paid) continue;
      for (const before of [DAYS_BEFORE, 0]) {
        const at = combine(o.date, '09:00');
        at.setDate(at.getDate() - before);
        if (at < ctx.from || at > ctx.to) continue;
        out.push({
          key: `payments:${o.payment.id}:${o.date}:${before}`,
          moduleId: paymentsMeta.id,
          sourceId: 'payments.due',
          title: `💳 ${o.payment.title} · ${amount(o.payment.amount)}`,
          body: before
            ? ctx.t('notifications.alerts.paymentSoon', { date: formatShortDate(fromDateKey(o.date), ctx.locale) })
            : ctx.t('notifications.alerts.paymentToday'),
          at: at.toISOString(),
          route: '/payments',
          icon: 'credit-card',
          color: paymentsMeta.accent,
        });
      }
    }
    return out;
  },
};
