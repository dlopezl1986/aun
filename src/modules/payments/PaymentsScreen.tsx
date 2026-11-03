import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useDialog } from '@/components/feedback/DialogProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Icon, type IconName } from '@/components/ui/Icon';
import { interaction } from '@/components/ui/interaction';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useLocale } from '@/hooks/useLocale';
import { useToday } from '@/hooks/useToday';
import { useTheme } from '@/theme';
import { formatMonthYear, formatShortDate, fromDateKey } from '@/utils/date';
import { lighten, withAlpha } from '@/utils/color';
import { DueRow } from './components/DueRow';
import { PaymentSheet } from './components/PaymentSheet';
import { monthsLeftLabel, relativeDay, scheduleLabel } from './describe';
import { useAddSaving, useMoney, usePayments, useTogglePaid } from './hooks';
import { paymentsMeta } from './meta';
import {
  addMonthsKey,
  allOccurrences,
  monthEnd,
  monthlyAverage,
  monthlySaving,
  monthStart,
  monthSummary,
  nextUnpaid,
  overdue,
  parseAmount,
  savingPlan,
  type Occurrence,
  type SavingGoal,
} from './schedule';
import { categoryOf, type Payment } from './types';

/** How many months the "Próximos pagos" list shows (this one included). */
const MONTHS_AHEAD = 3;

function Progress({ value, color }: { value: number; color: string }) {
  const { colors, radius } = useTheme();
  return (
    <View style={{ height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: 'hidden' }}>
      <View
        style={{
          width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`,
          height: '100%',
          borderRadius: radius.pill,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

/** Big number tile at the top ("Este mes", "Apartar este mes"…). */
function Tile({
  icon,
  color,
  label,
  value,
  detail,
  children,
}: {
  icon: IconName;
  color: string;
  label: string;
  value: string;
  detail: string;
  children?: ReactNode;
}) {
  const { spacing, radius, mode } = useTheme();
  const { isCompact } = useBreakpoint();
  const ink = mode === 'dark' ? lighten(color, 0.35) : color;
  return (
    <Card style={{ flexGrow: 1, flexBasis: isCompact ? 150 : 220, gap: spacing.sm, padding: isCompact ? spacing.lg : undefined }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: radius.md,
            backgroundColor: withAlpha(color, 0.14),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon} size={17} color={ink} />
        </View>
        <AppText variant="overline" color={ink} style={{ flex: 1 }} numberOfLines={1}>
          {label}
        </AppText>
      </View>
      <AppText variant={isCompact ? 'title' : 'display'} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
      <AppText variant="small" tone="textMuted" numberOfLines={2}>
        {detail}
      </AppText>
      {children}
    </Card>
  );
}

function SavingRow({ goal, today, onSave, onOpen }: { goal: SavingGoal; today: string; onSave: () => void; onOpen: () => void }) {
  const { t } = useTranslation();
  const { spacing, colors } = useTheme();
  const money = useMoney();
  const locale = useLocale();
  const cat = categoryOf(goal.payment.categoryId);
  const done = goal.remaining <= 0;
  return (
    <View style={{ gap: spacing.sm, paddingVertical: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Pressable onPress={onOpen} accessibilityRole="button" style={{ flex: 1, minWidth: 0 }}>
          <AppText variant="bodyStrong" numberOfLines={1}>{`${cat.emoji} ${goal.payment.title}`}</AppText>
          <AppText variant="caption" tone="textMuted" numberOfLines={1}>
            {`${money(goal.amount)} · ${formatShortDate(fromDateKey(goal.date), locale)} (${monthsLeftLabel(t, today, goal.date)})`}
          </AppText>
        </Pressable>
        <View style={{ alignItems: 'flex-end' }}>
          <AppText variant="subheading" color={done ? colors.success : goal.months >= 1 ? paymentsMeta.accent : colors.danger}>
            {done
              ? t('payments.saving.ready')
              : goal.months >= 1
                ? t('payments.saving.perMonth', { amount: money(goal.perMonth) })
                : money(goal.remaining)}
          </AppText>
          {done ? null : goal.months < 1 ? (
            <AppText variant="caption" color={colors.danger}>
              {t('payments.saving.missing')}
            </AppText>
          ) : goal.leftThisMonth <= 0 ? (
            <AppText variant="caption" color={colors.success}>
              {t('payments.saving.doneThisMonth')}
            </AppText>
          ) : goal.leftThisMonth < goal.perMonth ? (
            <AppText variant="caption" tone="textMuted">
              {t('payments.saving.leftThisMonth', { amount: money(goal.leftThisMonth) })}
            </AppText>
          ) : null}
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Progress value={goal.saved / goal.amount} color={done ? colors.success : paymentsMeta.accent} />
        </View>
        <AppText variant="caption" tone="textMuted">
          {t('payments.saving.savedOf', { saved: money(goal.saved), amount: money(goal.amount) })}
        </AppText>
        <Button label={t('payments.saving.add')} icon="plus" size="sm" variant="soft" onPress={onSave} />
      </View>
    </View>
  );
}

/** Pagos: what we have to pay, when, and how much to put aside for it. */
export function PaymentsScreen() {
  const { t } = useTranslation();
  const { spacing, colors, radius } = useTheme();
  const { breakpoint, isCompact: compact } = useBreakpoint();
  const locale = useLocale();
  const money = useMoney();
  const dialog = useDialog();
  const today = useToday();
  const payments = usePayments();
  const togglePaid = useTogglePaid();
  const addSaving = useAddSaving();
  const params = useLocalSearchParams<{ payment?: string }>();
  const [editing, setEditing] = useState<Payment | null>(null);
  const [creating, setCreating] = useState(false);

  const all = useMemo(() => payments.data ?? [], [payments.data]);
  const deepLinked = params.payment ? all.find((p) => p.id === params.payment) : undefined;
  const sheetPayment = editing ?? deepLinked ?? null;
  const closeSheet = () => {
    setEditing(null);
    setCreating(false);
    if (params.payment) router.setParams({ payment: undefined });
  };

  const month = useMemo(() => monthSummary(all, today), [all, today]);
  const late = useMemo(() => overdue(all, today), [all, today]);
  const plan = useMemo(() => savingPlan(all, today), [all, today]);
  const toSave = monthlySaving(plan);
  const savingNow = plan.filter((g) => g.months >= 1 && g.leftThisMonth > 0).length;
  const average = monthlyAverage(all, today);
  const next = useMemo(() => allOccurrences(all, today, addMonthsKey(today, 24)).find((o) => !o.paid) ?? null, [all, today]);

  /** Overdue first, then this month and the next ones, grouped by month. */
  const groups = useMemo(() => {
    const upcoming = allOccurrences(all, monthStart(today), monthEnd(addMonthsKey(monthStart(today), MONTHS_AHEAD - 1)));
    const out: { key: string; title: string; items: Occurrence[]; total: number }[] = [];
    const lateBefore = late.filter((o) => o.date < monthStart(today));
    if (lateBefore.length)
      out.push({
        key: 'late',
        title: t('payments.overdueTitle'),
        items: lateBefore,
        total: lateBefore.reduce((s, o) => s + o.payment.amount, 0),
      });
    for (const o of upcoming) {
      const key = o.date.slice(0, 7);
      let g = out.find((x) => x.key === key);
      if (!g) {
        const title = formatMonthYear(fromDateKey(o.date), locale);
        g = { key, title: title.charAt(0).toUpperCase() + title.slice(1), items: [], total: 0 };
        out.push(g);
      }
      g.items.push(o);
      g.total += o.payment.amount;
    }
    return out;
  }, [all, today, late, locale, t]);

  const toggle = (o: Occurrence) => togglePaid.mutate({ id: o.payment.id, date: o.date, paid: !o.paid });

  const saveFor = async (g: SavingGoal) => {
    const answer = await dialog.prompt({
      title: t('payments.saving.promptTitle', { title: g.payment.title }),
      message: t('payments.saving.promptMessage', { saved: money(g.saved), amount: money(g.amount) }),
      label: t('payments.form.amount'),
      initialValue: String(g.months >= 1 ? g.leftThisMonth || Math.min(g.perMonth, g.remaining) : g.remaining).replace('.', ','),
      confirmLabel: t('payments.saving.add'),
    });
    const amount = answer ? parseAmount(answer) : null;
    if (amount) addSaving.mutate({ id: g.payment.id, amount });
  };

  const newButton = <Button label={t('payments.new')} icon="plus" size="sm" onPress={() => setCreating(true)} />;
  const header = (
    <PageHeader
      title={t('modules.payments.title')}
      subtitle={t('payments.subtitle')}
      icon={paymentsMeta.icon}
      accent={paymentsMeta.accent}
      actions={newButton}
    />
  );
  const sheet = <PaymentSheet visible={creating || !!sheetPayment} payment={creating ? null : sheetPayment} onClose={closeSheet} />;

  if (payments.isLoading)
    return (
      <Screen>
        {header}
        <LoadingState />
      </Screen>
    );

  if (!all.length)
    return (
      <Screen>
        {header}
        <Card>
          <EmptyState
            icon="credit-card"
            accent={paymentsMeta.accent}
            title={t('payments.empty')}
            description={t('payments.emptyHint')}
            actionLabel={t('payments.new')}
            onAction={() => setCreating(true)}
          />
        </Card>
        {sheet}
      </Screen>
    );

  const tiles = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: compact ? spacing.md : spacing.lg }}>
      <Tile
        icon="calendar"
        color={paymentsMeta.accent}
        label={t('payments.tiles.thisMonth')}
        value={money(month.total)}
        detail={
          month.count
            ? t('payments.tiles.paidOf', { paid: money(month.paid), count: month.count, paidCount: month.paidCount })
            : t('payments.tiles.nothingThisMonth')
        }
      >
        {month.total > 0 ? <Progress value={month.paid / month.total} color={colors.success} /> : null}
      </Tile>
      <Tile
        icon="archive"
        color="#7C3AED"
        label={t('payments.tiles.toSave')}
        value={money(toSave)}
        detail={
          savingNow
            ? t('payments.tiles.toSaveDetail', { count: savingNow })
            : plan.some((g) => g.months >= 1 && g.remaining > 0)
              ? t('payments.tiles.allSaved')
              : t('payments.tiles.nothingToSave')
        }
      />
      {late.length ? (
        <Tile
          icon="alert-circle"
          color={colors.danger}
          label={t('payments.tiles.overdue')}
          value={money(late.reduce((s, o) => s + o.payment.amount, 0))}
          detail={t('payments.tiles.overdueDetail', { count: late.length })}
        />
      ) : (
        <Tile
          icon="clock"
          color="#0D9488"
          label={t('payments.tiles.next')}
          value={next ? money(next.payment.amount) : '—'}
          detail={next ? `${next.payment.title} · ${relativeDay(t, next.date, today)}` : t('payments.tiles.nothingNext')}
        />
      )}
    </View>
  );

  const upcomingCard = (
    <Card>
      <CardHeader title={t('payments.upcoming')} subtitle={t('payments.upcomingHint')} icon="calendar" accent={paymentsMeta.accent} />
      {!groups.length ? (
        <EmptyState compact icon="check-circle" accent={colors.success} title={t('payments.upcomingEmpty')} />
      ) : (
        <View style={{ gap: spacing.lg }}>
          {groups.map((g) => (
            <View key={g.key} style={{ gap: spacing.xs }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
                <AppText
                  variant="smallStrong"
                  color={g.key === 'late' ? colors.danger : colors.textMuted}
                  style={{ flex: 1 }}
                  accessibilityRole="header"
                >
                  {g.title}
                </AppText>
                <AppText variant="caption" tone="textSubtle">
                  {money(Math.round(g.total * 100) / 100)}
                </AppText>
              </View>
              {g.items.map((o) => (
                <DueRow
                  key={`${o.payment.id}:${o.date}`}
                  occurrence={o}
                  today={today}
                  onToggle={() => toggle(o)}
                  onOpen={() => setEditing(o.payment)}
                />
              ))}
            </View>
          ))}
        </View>
      )}
    </Card>
  );

  const savingCard = (
    <Card>
      <CardHeader title={t('payments.saving.title')} subtitle={t('payments.saving.hint')} icon="archive" accent="#7C3AED" />
      {!plan.length ? (
        <AppText variant="small" tone="textMuted">
          {t('payments.saving.empty')}
        </AppText>
      ) : (
        <View>
          {plan.map((g) => (
            <SavingRow key={g.payment.id} goal={g} today={today} onSave={() => void saveFor(g)} onOpen={() => setEditing(g.payment)} />
          ))}
        </View>
      )}
    </Card>
  );

  const allCard = (
    <Card>
      <CardHeader
        title={t('payments.all', { count: all.length })}
        subtitle={average ? t('payments.average', { amount: money(average) }) : undefined}
        icon="list"
        accent={paymentsMeta.accent}
      />
      <View style={{ gap: spacing.xxs }}>
        {all.map((p) => {
          const cat = categoryOf(p.categoryId);
          const finished = !nextUnpaid(p, today);
          return (
            <Pressable
              key={p.id}
              onPress={() => setEditing(p)}
              accessibilityRole="button"
              accessibilityLabel={`${p.title}, ${money(p.amount)}`}
              style={(s) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                minHeight: 52,
                paddingHorizontal: spacing.sm,
                marginHorizontal: -spacing.sm,
                borderRadius: radius.md,
                backgroundColor: interaction(s).hovered ? colors.surfaceMuted : 'transparent',
                opacity: finished ? 0.6 : 1,
              })}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: withAlpha(cat.color, 0.14),
                }}
              >
                <AppText variant="body">{cat.emoji}</AppText>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText variant="bodyStrong" numberOfLines={1}>
                  {p.title}
                </AppText>
                <AppText variant="caption" tone="textMuted" numberOfLines={1}>
                  {scheduleLabel(t, p, today, locale)}
                </AppText>
              </View>
              <AppText variant="bodyStrong">{money(p.amount)}</AppText>
              <Icon name="chevron-right" size={16} color={colors.textSubtle} />
            </Pressable>
          );
        })}
      </View>
    </Card>
  );

  const wide = breakpoint === 'expanded' || breakpoint === 'wide';
  return (
    <Screen>
      {header}
      {tiles}
      {wide ? (
        <View style={{ flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' }}>
          <View style={{ flex: 1.25, minWidth: 0 }}>{upcomingCard}</View>
          <View style={{ flex: 1, minWidth: 0, gap: spacing.xl }}>
            {savingCard}
            {allCard}
          </View>
        </View>
      ) : (
        <>
          {upcomingCard}
          {savingCard}
          {allCard}
        </>
      )}
      {sheet}
    </Screen>
  );
}
