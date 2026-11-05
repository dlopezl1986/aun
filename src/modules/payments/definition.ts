import type { AppModule } from '@/types/module';
import { paymentAlertSource } from './alerts';
import { paymentsMeta } from './meta';
import { PaymentsTodaySummary, QuickPaymentSheet } from './widgets';

export const paymentsModule: AppModule = {
  id: paymentsMeta.id,
  routeName: 'payments',
  titleKey: 'modules.payments.title',
  descriptionKey: 'modules.payments.description',
  icon: paymentsMeta.icon,
  accent: paymentsMeta.accent,
  kind: 'feature',
  defaultEnabled: true,
  nav: { section: 'main', order: 58, mobilePriority: 7 },
  notificationSource: true,
  alerts: [paymentAlertSource],
  entitlement: null,
  todaySummary: PaymentsTodaySummary,
  quickActions: [{ id: 'payments.add', labelKey: 'payments.quick', icon: 'credit-card', Sheet: QuickPaymentSheet }],
  search: { search: (q, s) => s.payments.search(q.text) },
  // No widgets on Inicio (user's decision, 2026-11-05): their «Hoy» tile is enough.
};
