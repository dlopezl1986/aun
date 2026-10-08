import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useDialog } from '@/components/feedback/DialogProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { InfoNote } from '@/components/ui/InfoNote';
import { interaction } from '@/components/ui/interaction';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useLocale } from '@/hooks/useLocale';
import { useNow } from '@/hooks/useNow';
import { useToday } from '@/hooks/useToday';
import { useModules, useNotificationPrefs } from '@/state/userSettingsStore';
import { useTheme } from '@/theme';
import type { AlertItem } from '@/types/module';
import { withAlpha } from '@/utils/color';
import { addDays, combine, formatLongDate, formatTime, fromDateKey, toDateKey } from '@/utils/date';
import { ReminderFormSheet } from './components/ReminderFormSheet';
import { ReminderRow } from './components/ReminderRow';
import { useAlerts, useCompleteReminder, useMarkAlertsSeen, useReminders, useRemoveReminder, useSnoozeReminder } from './hooks';
import { notificationsMeta } from './meta';
import type { Reminder } from './types';

function AlertRow({ alert, past, moduleName, moduleColor }: { alert: AlertItem; past: boolean; moduleName: string; moduleColor: string }) {
  const locale = useLocale();
  const { colors, spacing, radius } = useTheme();
  const color = alert.color ?? moduleColor;
  return (
    <Pressable
      onPress={alert.route ? () => router.navigate(alert.route as Href) : undefined}
      accessibilityRole={alert.route ? 'link' : undefined}
      accessibilityLabel={`${formatTime(new Date(alert.at), locale)}, ${alert.title}${alert.body ? `, ${alert.body}` : ''}, ${moduleName}`}
      style={(s) => ({
        flexDirection: 'row',
        gap: spacing.md,
        alignItems: 'flex-start',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.md,
        opacity: past ? 0.55 : 1,
        backgroundColor: interaction(s).hovered && alert.route ? colors.surfaceMuted : 'transparent',
      })}
    >
      <AppText variant="smallStrong" tone={past ? 'textSubtle' : 'text'} style={{ width: 44, paddingTop: 6 }}>
        {formatTime(new Date(alert.at), locale)}
      </AppText>
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: withAlpha(color, 0.14),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={past ? 'check' : (alert.icon ?? 'bell')} size={15} color={color} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="bodyStrong" numberOfLines={2}>
          {alert.title}
        </AppText>
        {alert.body ? (
          <AppText variant="small" tone="textMuted" numberOfLines={2}>
            {alert.body}
          </AppText>
        ) : null}
        <AppText variant="caption" tone="textSubtle">
          {moduleName}
        </AppText>
      </View>
    </Pressable>
  );
}

const SNOOZE_OPTIONS = [10, 60, 180] as const;

/** 🔔 Notificaciones (sections 38–39): what is coming from every module + manual reminders. */
export function NotificationsScreen() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { spacing } = useTheme();
  const { breakpoint } = useBreakpoint();
  const dialog = useDialog();
  const today = useToday();
  const now = useNow();
  const prefs = useNotificationPrefs();
  const modules = useModules();
  const alerts = useAlerts(today, 7);
  const reminders = useReminders();
  const complete = useCompleteReminder();
  const snooze = useSnoozeReminder();
  const remove = useRemoveReminder();
  const markSeen = useMarkAlertsSeen();
  const [form, setForm] = useState<{ open: boolean; reminder: Reminder | null }>({ open: false, reminder: null });
  const [snoozing, setSnoozing] = useState<Reminder | null>(null);

  // Opening the centre marks everything that already happened as seen.
  useFocusEffect(
    useCallback(() => {
      markSeen();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const moduleInfo = useMemo(() => new Map(modules.map((m) => [m.id, { name: t(m.titleKey), color: m.accent }])), [modules, t]);
  const days = useMemo(() => {
    const map = new Map<string, AlertItem[]>();
    const tomorrowKey = toDateKey(addDays(fromDateKey(today), 1));
    for (const a of alerts.data ?? []) {
      const k = toDateKey(new Date(a.at));
      // The nightly "para mañana" repeats every evening: listing it once per day adds noise.
      if (a.sourceId === 'family.tomorrow' && k > tomorrowKey) continue;
      map.set(k, [...(map.get(k) ?? []), a]);
    }
    return [...map.entries()];
  }, [alerts.data, today]);

  const tomorrow = toDateKey(addDays(fromDateKey(today), 1));
  const dayTitle = (k: string) =>
    k === today
      ? `${t('common.today')} · ${formatLongDate(fromDateKey(k), locale)}`
      : k === tomorrow
        ? `${t('common.tomorrow')} · ${formatLongDate(fromDateKey(k), locale)}`
        : formatLongDate(fromDateKey(k), locale);

  const onDelete = async (r: Reminder) => {
    const ok = await dialog.confirm({
      title: t('notifications.deleteTitle'),
      message: r.title,
      confirmLabel: t('common.delete'),
      destructive: true,
    });
    if (ok) remove.mutate(r.id);
  };
  const minutesUntilTomorrow9 = () => Math.round((combine(tomorrow, '09:00').getTime() - now) / 60_000);

  const center = (
    <Card style={{ flex: 1.3, minWidth: 0 }}>
      <CardHeader
        title={t('notifications.center')}
        icon="bell"
        accent={notificationsMeta.accent}
        subtitle={t('notifications.centerSubtitle')}
      />
      {alerts.isLoading ? (
        <LoadingState />
      ) : alerts.isError ? (
        <ErrorState onRetry={() => void alerts.refetch()} />
      ) : !days.length ? (
        <EmptyState
          compact
          icon="coffee"
          accent={notificationsMeta.accent}
          title={t('notifications.empty')}
          description={t('notifications.emptyDescription')}
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          {days.map(([day, items]) => (
            <View key={day}>
              <AppText variant="overline" tone="textMuted" style={{ marginBottom: spacing.xs }} accessibilityRole="header">
                {dayTitle(day)}
              </AppText>
              {items.map((a) => (
                <AlertRow
                  key={a.key}
                  alert={a}
                  past={new Date(a.at).getTime() <= now}
                  moduleName={moduleInfo.get(a.moduleId)?.name ?? a.moduleId}
                  moduleColor={moduleInfo.get(a.moduleId)?.color ?? notificationsMeta.accent}
                />
              ))}
            </View>
          ))}
        </View>
      )}
    </Card>
  );

  const remindersCard = (
    <Card style={{ flex: 1, minWidth: 0 }}>
      <CardHeader
        title={t('notifications.reminders')}
        icon="clock"
        accent={notificationsMeta.accent}
        actionLabel={t('notifications.newReminder')}
        onAction={() => setForm({ open: true, reminder: null })}
      />
      {reminders.isLoading ? (
        <LoadingState />
      ) : !reminders.data?.length ? (
        <EmptyState
          compact
          icon="bell"
          accent={notificationsMeta.accent}
          title={t('notifications.noReminders')}
          description={t('notifications.noRemindersDescription')}
        />
      ) : (
        <View>
          {reminders.data.map((r) => (
            <ReminderRow
              key={r.id}
              reminder={r}
              onToggle={(x) => complete.mutate(x)}
              onSnooze={setSnoozing}
              onEdit={(x) => setForm({ open: true, reminder: x })}
              onDelete={(x) => void onDelete(x)}
            />
          ))}
        </View>
      )}
    </Card>
  );

  const wide = breakpoint === 'expanded' || breakpoint === 'wide';
  return (
    <Screen>
      <PageHeader
        title={t('modules.notifications.title')}
        subtitle={t('notifications.subtitle')}
        icon={notificationsMeta.icon}
        accent={notificationsMeta.accent}
        actions={
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            <Button label={t('notifications.newReminder')} icon="plus" onPress={() => setForm({ open: true, reminder: null })} />
            <IconButton icon="settings" label={t('notifications.settings.title')} onPress={() => router.push('/settings/notifications')} />
          </View>
        }
      />
      {!prefs.system ? (
        <InfoNote title={t('notifications.systemOffTitle')} description={t('notifications.systemOff')} icon="bell-off" />
      ) : null}
      {wide ? (
        <View style={{ flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' }}>
          {center}
          {remindersCard}
        </View>
      ) : (
        <>
          {remindersCard}
          {center}
        </>
      )}
      <ReminderFormSheet visible={form.open} reminder={form.reminder} onClose={() => setForm({ open: false, reminder: null })} />
      <Sheet visible={!!snoozing} onClose={() => setSnoozing(null)} title={t('notifications.snooze')}>
        <View style={{ gap: spacing.sm }}>
          {[
            ...SNOOZE_OPTIONS.map((m) => ({
              m,
              label: t('notifications.snoozeFor', { count: m >= 60 ? m / 60 : m, unit: m >= 60 ? 'h' : 'min' }),
            })),
            { m: 0, label: t('notifications.snoozeTomorrow') },
          ].map(({ m, label }) => (
            <Button
              key={label}
              label={label}
              variant="secondary"
              onPress={() => {
                if (snoozing) snooze.mutate({ reminder: snoozing, minutes: m || minutesUntilTomorrow9() });
                setSnoozing(null);
              }}
            />
          ))}
        </View>
      </Sheet>
    </Screen>
  );
}
