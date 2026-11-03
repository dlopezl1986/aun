import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useLocale } from '@/hooks/useLocale';
import { useDataMutation, useDataQuery } from '@/state/queryClient';
import { todayKey, type DateKey } from '@/utils/date';
import type { PaymentInput } from './service';

export function usePayments() {
  return useDataQuery('payments', ['list'], (s) => s.payments.list());
}

export function useCreatePayment() {
  const { t } = useTranslation();
  return useDataMutation((s, input: PaymentInput) => s.payments.create(input), {
    invalidate: ['payments'],
    successMessage: (p) => t('payments.toast.created', { title: p.title }),
  });
}

export function useUpdatePayment() {
  const { t } = useTranslation();
  return useDataMutation((s, v: { id: string; patch: Partial<PaymentInput> }) => s.payments.update(v.id, v.patch), {
    invalidate: ['payments'],
    successMessage: t('common.saved'),
  });
}

export function useRemovePayment() {
  const { t } = useTranslation();
  return useDataMutation((s, id: string) => s.payments.remove(id), {
    invalidate: ['payments'],
    successMessage: t('payments.toast.deleted'),
  });
}

/** Marks or unmarks one due date as paid. */
export function useTogglePaid() {
  return useDataMutation(
    (s, v: { id: string; date: DateKey; paid: boolean }) =>
      v.paid ? s.payments.markPaid(v.id, v.date) : s.payments.unmarkPaid(v.id, v.date),
    { invalidate: ['payments'] },
  );
}

export function useAddSaving() {
  const { t } = useTranslation();
  return useDataMutation((s, v: { id: string; amount: number }) => s.payments.addSaving(v.id, v.amount, todayKey()), {
    invalidate: ['payments'],
    successMessage: t('payments.toast.saved'),
  });
}

/** "1.234,50 €" in the app language. */
export function useMoney(): (n: number) => string {
  const locale = useLocale();
  return useCallback(
    (n: number) =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
        maximumFractionDigits: 2,
      }).format(n),
    [locale],
  );
}
