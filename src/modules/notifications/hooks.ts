import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useLocale } from '@/hooks/useLocale';
import { useNow } from '@/hooks/useNow';
import { useToday } from '@/hooks/useToday';
import { collectAlerts } from '@/services/notifications/alerts';
import { useServices } from '@/services/ServicesProvider';
import { useDataMutation, useDataQuery } from '@/state/queryClient';
import { useEnabledModules, useNotificationPrefs, useUserSettings } from '@/state/userSettingsStore';
import { addDays, formatShortDate, formatTime, fromDateKey } from '@/utils/date';
import type { ReminderInput } from './service';
import type { Reminder } from './types';

export function useReminders() {
  return useDataQuery('notifications', ['reminders'], (s) => s.notifications.listReminders());
}

/**
 * Alerts of every enabled module between `fromKey` (00:00) and `days` later.
 * Refreshed after any data mutation (see useDataMutation).
 */
export function useAlerts(fromKey: string, days: number) {
  const services = useServices();
  const modules = useEnabledModules();
  const prefs = useNotificationPrefs();
  const { t } = useTranslation();
  const locale = useLocale();
  const ids = modules.map((m) => m.id).join(',');
  return useQuery({
    queryKey: ['u', services.userId, 'alerts', fromKey, days, ids, JSON.stringify(prefs.sources), prefs.tomorrowTime, locale],
    queryFn: () =>
      collectAlerts(services, modules, prefs, {
        from: fromDateKey(fromKey),
        to: new Date(addDays(fromDateKey(fromKey), days).getTime() - 1),
        t: (k, o) => String(t(k, o as never)),
        locale,
        tomorrowTime: prefs.tomorrowTime,
      }),
  });
}

/** Alerts that already happened today and were not seen in the centre yet. */
export function useNotificationBadge(): number {
  const today = useToday();
  const now = useNow();
  const lastSeen = useNotificationPrefs().lastSeenAt;
  const alerts = useAlerts(today, 1);
  return useMemo(() => {
    const since = lastSeen ? new Date(lastSeen).getTime() : 0;
    return (alerts.data ?? []).filter((a) => {
      const t = new Date(a.at).getTime();
      return t <= now && t > since;
    }).length;
  }, [alerts.data, lastSeen, now]);
}

export function useMarkAlertsSeen() {
  const setPrefs = useUserSettings((s) => s.setNotificationPrefs);
  return () => void setPrefs({ lastSeenAt: new Date().toISOString() });
}

export function useCreateReminder() {
  const { t } = useTranslation();
  return useDataMutation((s, v: ReminderInput) => s.notifications.createReminder(v), {
    invalidate: ['notifications'],
    successMessage: t('notifications.toast.created'),
  });
}

export function useUpdateReminder() {
  const { t } = useTranslation();
  return useDataMutation((s, v: { id: string; input: ReminderInput }) => s.notifications.updateReminder(v.id, v.input), {
    invalidate: ['notifications'],
    successMessage: t('common.saved'),
  });
}

export function useCompleteReminder() {
  const { t } = useTranslation();
  const locale = useLocale();
  return useDataMutation((s, r: Reminder) => s.notifications.completeReminder(r), {
    invalidate: ['notifications'],
    successMessage: (res) =>
      res.next
        ? t('notifications.toast.next', {
            date: `${formatShortDate(new Date(res.next), locale)} · ${formatTime(new Date(res.next), locale)}`,
          })
        : res.reminder.done
          ? t('notifications.toast.done')
          : t('notifications.toast.reopened'),
  });
}

export function useSnoozeReminder() {
  const { t } = useTranslation();
  const locale = useLocale();
  return useDataMutation((s, v: { reminder: Reminder; minutes: number }) => s.notifications.snoozeReminder(v.reminder, v.minutes), {
    invalidate: ['notifications'],
    successMessage: (r) => t('notifications.toast.snoozed', { time: formatTime(new Date(r.at), locale) }),
  });
}

export function useRemoveReminder() {
  const { t } = useTranslation();
  return useDataMutation((s, id: string) => s.notifications.removeReminder(id), {
    invalidate: ['notifications'],
    successMessage: t('notifications.toast.deleted'),
  });
}
