import { router } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { SummaryTile } from '@/modules/dashboard/components/SummaryTile';
import { useToday } from '@/hooks/useToday';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';
import { addDays, fromDateKey, toDateKey } from '@/utils/date';
import { DueRow } from './components/DueRow';
import { PaymentSheet } from './components/PaymentSheet';
import { relativeDay } from './describe';
import { useMoney, usePayments, useTogglePaid } from './hooks';
import { paymentsMeta } from './meta';
import { addMonthsKey, allOccurrences, monthlySaving, monthSummary, overdue, savingPlan } from './schedule';

const openPayments = () => router.navigate('/payments');

/** "Pagos" on Inicio: this month, what to save, and the next due dates. */
export function PaymentsWidget() {
  const { t } = useTranslation();
  const { spacing, radius, colors } = useTheme();
  const money = useMoney();
  const today = useToday();
  const payments = usePayments();
  const toggle = useTogglePaid();
  const all = payments.data ?? [];
  const late = overdue(all, today);
  const next = [...late, ...allOccurrences(all, today, addMonthsKey(today, 2)).filter((o) => !o.paid)].slice(0, 4);
  const month = monthSummary(all, today);
  const toSave = monthlySaving(savingPlan(all, today));

  const stat = (label: string, value: string, color: string) => (
    <View style={{ flex: 1, padding: spacing.md, borderRadius: radius.md, backgroundColor: withAlpha(color, 0.1), gap: 2 }}>
      <AppText variant="overline" color={color} numberOfLines={1}>
        {label}
      </AppText>
      <AppText variant="heading" numberOfLines={1}>
        {value}
      </AppText>
    </View>
  );

  return (
    <Card style={{ flex: 1 }}>
      <CardHeader
        title={t('payments.widget.title')}
        icon={paymentsMeta.icon}
        accent={paymentsMeta.accent}
        actionLabel={t('common.open')}
        onAction={openPayments}
      />
      {payments.isLoading ? (
        <LoadingState />
      ) : !all.length ? (
        <EmptyState
          compact
          icon="credit-card"
          accent={paymentsMeta.accent}
          title={t('payments.empty')}
          actionLabel={t('payments.new')}
          onAction={openPayments}
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {stat(t('payments.tiles.thisMonth'), money(month.total - month.paid), paymentsMeta.accent)}
            {stat(t('payments.tiles.toSave'), money(toSave), '#7C3AED')}
          </View>
          {next.length ? (
            next.map((o) => (
              <DueRow
                key={`${o.payment.id}:${o.date}`}
                compact
                occurrence={o}
                today={today}
                onOpen={openPayments}
                onToggle={() => toggle.mutate({ id: o.payment.id, date: o.date, paid: true })}
              />
            ))
          ) : (
            <AppText variant="small" tone="textMuted">
              {t('payments.upcomingEmpty')}
            </AppText>
          )}
          {late.length ? (
            <AppText variant="caption" color={colors.danger}>
              {t('payments.tiles.overdueDetail', { count: late.length })}
            </AppText>
          ) : null}
        </View>
      )}
    </Card>
  );
}

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
