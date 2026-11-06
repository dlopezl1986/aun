import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useDialog } from '@/components/feedback/DialogProvider';
import { ChipGroup } from '@/components/forms/Chips';
import { DateField } from '@/components/forms/DateTimeFields';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { TextField } from '@/components/ui/TextField';
import { useLocale } from '@/hooks/useLocale';
import { useCurrentUser } from '@/state/authStore';
import { useTheme } from '@/theme';
import { formatShortDate, fromDateKey, todayKey, type DateKey } from '@/utils/date';
import { useCreatePayment, useMoney, useRemovePayment, useUpdatePayment } from '../hooks';
import { paymentsMeta } from '../meta';
import { addMonthsKey, lastDueDate, parseAmount, paymentCount } from '../schedule';
import { FREQUENCIES, PAYMENT_CATEGORIES, type Payment } from '../types';

type EndMode = 'none' | 'date' | 'count';

function Label({ children }: { children: string }) {
  return (
    <AppText variant="smallStrong" tone="textMuted">
      {children}
    </AppText>
  );
}

const formatAmount = (n: number) => String(n).replace('.', ',');

function Form({ payment, onClose }: { payment: Payment | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { spacing, colors, radius } = useTheme();
  const locale = useLocale();
  const money = useMoney();
  const dialog = useDialog();
  const create = useCreatePayment();
  const update = useUpdatePayment();
  const remove = useRemovePayment();

  const [title, setTitle] = useState(payment?.title ?? '');
  const [amountText, setAmountText] = useState(payment ? formatAmount(payment.amount) : '');
  const [everyMonths, setEveryMonths] = useState<number>(payment?.everyMonths ?? 1);
  const [startDate, setStartDate] = useState<DateKey>(payment?.startDate ?? todayKey());
  const [endMode, setEndMode] = useState<EndMode>(payment?.endDate ? 'date' : 'none');
  const [endDate, setEndDate] = useState<DateKey>(payment?.endDate ?? addMonthsKey(payment?.startDate ?? todayKey(), 11));
  const [countText, setCountText] = useState(() => {
    const n = payment?.endDate ? paymentCount(payment) : null;
    return n ? String(n) : '12';
  });
  const [categoryId, setCategoryId] = useState(payment?.categoryId ?? 'home');
  const [notes, setNotes] = useState(payment?.notes ?? '');
  const [datesValid, setDatesValid] = useState(true);
  const me = useCurrentUser();
  // Only whoever added it chooses who sees it.
  const canChooseVisibility = !payment || payment.ownerId === me.id;
  const [isPrivate, setIsPrivate] = useState(!!payment?.private);

  const amount = parseAmount(amountText);
  const count = Math.floor(Number(countText));
  const countValid = Number.isFinite(count) && count >= 1 && count <= 600;
  const recurring = everyMonths > 0;
  const finalEnd: DateKey | null =
    !recurring || endMode === 'none'
      ? null
      : endMode === 'count'
        ? countValid
          ? lastDueDate({ startDate, everyMonths }, count)
          : null
        : endDate;
  const endValid = !recurring || endMode === 'none' || (endMode === 'count' ? countValid : endDate >= startDate);
  const valid = !!title.trim() && amount !== null && datesValid && endValid;

  const total = recurring && finalEnd ? paymentCount({ startDate, everyMonths, endDate: finalEnd }) : null;
  const summary =
    amount === null
      ? null
      : !recurring
        ? t('payments.form.summaryOnce', { amount: money(amount), date: formatShortDate(fromDateKey(startDate), locale) })
        : total
          ? t('payments.form.summarySeries', {
              count: total,
              last: formatShortDate(fromDateKey(finalEnd!), locale),
              total: money(Math.round(amount * total * 100) / 100),
            })
          : t('payments.form.summaryEndless', { amount: money(Math.round((amount * 12 * 100) / everyMonths) / 100) });

  const save = () => {
    if (!valid || amount === null) return;
    const input = {
      title,
      amount,
      everyMonths,
      startDate,
      endDate: finalEnd,
      categoryId,
      notes,
      ...(canChooseVisibility ? { private: isPrivate } : {}),
    };
    if (payment) update.mutate({ id: payment.id, patch: input }, { onSuccess: onClose });
    else create.mutate(input, { onSuccess: onClose });
  };

  const del = async () => {
    if (!payment) return;
    const ok = await dialog.confirm({
      title: t('payments.deleteTitle', { title: payment.title }),
      message: t('payments.deleteMessage'),
      confirmLabel: t('common.delete'),
      destructive: true,
    });
    if (ok) remove.mutate(payment.id, { onSuccess: onClose });
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={payment ? t('payments.edit') : t('payments.new')}
      footer={
        <>
          {payment ? <Button label={t('common.delete')} icon="trash-2" variant="ghost" onPress={() => void del()} /> : null}
          <View style={{ flex: 1 }} />
          <Button label={t('common.cancel')} variant="ghost" onPress={onClose} />
          <Button label={t('common.save')} onPress={save} disabled={!valid} loading={create.isPending || update.isPending} />
        </>
      }
    >
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 2 }}>
          <TextField
            label={t('payments.form.title')}
            value={title}
            onChangeText={setTitle}
            placeholder={t('payments.form.titlePlaceholder')}
            autoFocus={!payment}
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            label={t('payments.form.amount')}
            value={amountText}
            onChangeText={setAmountText}
            placeholder="0,00"
            inputMode="decimal"
            leftIcon="tag"
            error={amountText && amount === null ? t('payments.form.badAmount') : null}
          />
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Label>{t('payments.form.frequency')}</Label>
        <ChipGroup<number>
          accessibilityLabel={t('payments.form.frequency')}
          color={paymentsMeta.accent}
          selected={everyMonths}
          onToggle={setEveryMonths}
          options={FREQUENCIES.map((f) => ({ value: f, label: t(`payments.every.${f}`) }))}
        />
      </View>

      <DateField
        label={recurring ? t('payments.form.firstDate') : t('payments.form.date')}
        value={startDate}
        onChange={setStartDate}
        onValidityChange={setDatesValid}
      />

      {recurring ? (
        <View style={{ gap: spacing.sm }}>
          <Label>{t('payments.form.until')}</Label>
          <ChipGroup<EndMode>
            accessibilityLabel={t('payments.form.until')}
            color={paymentsMeta.accent}
            selected={endMode}
            onToggle={setEndMode}
            options={[
              { value: 'none', label: t('payments.form.untilNone') },
              { value: 'date', label: t('payments.form.untilDate') },
              { value: 'count', label: t('payments.form.untilCount') },
            ]}
          />
          {endMode === 'date' ? <DateField label={t('payments.form.endDate')} value={endDate} onChange={setEndDate} /> : null}
          {endMode === 'count' ? (
            <TextField
              label={t('payments.form.count')}
              value={countText}
              onChangeText={setCountText}
              inputMode="numeric"
              error={countValid ? null : t('payments.form.badCount')}
            />
          ) : null}
          {endMode === 'date' && endDate < startDate ? (
            <AppText variant="caption" color={colors.danger}>
              {t('payments.form.endBeforeStart')}
            </AppText>
          ) : null}
        </View>
      ) : null}

      {summary ? (
        <View style={{ padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.warningSoft }}>
          <AppText variant="small" color={colors.warning}>
            {summary}
          </AppText>
        </View>
      ) : null}

      {canChooseVisibility ? (
        <View style={{ gap: spacing.sm }}>
          <Label>{t('payments.form.visibility')}</Label>
          <ChipGroup<'family' | 'private'>
            accessibilityLabel={t('payments.form.visibility')}
            color={paymentsMeta.accent}
            selected={isPrivate ? 'private' : 'family'}
            onToggle={(v) => setIsPrivate(v === 'private')}
            options={[
              { value: 'family', label: t('payments.form.visibilityFamily') },
              { value: 'private', label: t('payments.form.visibilityPrivate') },
            ]}
          />
          {isPrivate ? (
            <AppText variant="caption" tone="textMuted">
              {t('payments.form.visibilityPrivateHint')}
            </AppText>
          ) : null}
        </View>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <Label>{t('payments.form.category')}</Label>
        <ChipGroup<string>
          accessibilityLabel={t('payments.form.category')}
          color={paymentsMeta.accent}
          selected={categoryId}
          onToggle={setCategoryId}
          options={PAYMENT_CATEGORIES.map((c) => ({ value: c.id, label: `${c.emoji} ${t(`payments.categories.${c.id}`)}` }))}
        />
      </View>

      <TextField
        label={t('payments.form.notes')}
        value={notes}
        onChangeText={setNotes}
        placeholder={t('payments.form.notesPlaceholder')}
        multiline
      />
    </Sheet>
  );
}

/** Create (payment = null) or edit a payment. */
export function PaymentSheet({ visible, payment, onClose }: { visible: boolean; payment: Payment | null; onClose: () => void }) {
  return visible ? <Form key={payment?.id ?? 'new'} payment={payment} onClose={onClose} /> : null;
}
