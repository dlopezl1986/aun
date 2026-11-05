import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { SummaryTile } from '@/modules/dashboard/components/SummaryTile';
import { useToday } from '@/hooks/useToday';
import { addDays, fromDateKey, toDateKey } from '@/utils/date';
import { PaymentSheet } from './components/PaymentSheet';
import { relativeDay } from './describe';
import { useMoney, usePayments } from './hooks';
import { paymentsMeta } from './meta';
import { allOccurrences, overdue } from './schedule';

const openPayments = () => router.navigate('/payments');

/** Line in the "HOY" panel: payments due in the next 7 days. */
export function PaymentsTodaySummary() {
  const { t } = useTranslation();
  const money = useMoney();
  const today = useToday();
  const payments = usePayments();
  const all = payments.data ?? [];
  const late = overdue(all, today);
  const week = allOccurrences(all, today, toDateKey(addDays(fromDateKey(today), 7))).filter((o) => !o.paid);
  const due = [...late, ...week];
  return (
    <SummaryTile
      icon={paymentsMeta.icon}
      accent={paymentsMeta.accent}
      label={t('modules.payments.title')}
      loading={payments.isLoading}
      alert={late.length > 0}
      alertLabel={t('payments.overdue')}
      value={
        due.length
          ? t('payments.summary.due', { amount: money(due.reduce((s, o) => s + o.payment.amount, 0)) })
          : t('payments.summary.none')
      }
      details={due.slice(0, 2).map((o) => `${o.payment.title} · ${relativeDay(t, o.date, today)}`)}
      onPress={openPayments}
    />
  );
}

/** Quick action from Inicio: add a payment without leaving the dashboard. */
export function QuickPaymentSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return <PaymentSheet visible={visible} payment={null} onClose={onClose} />;
}
