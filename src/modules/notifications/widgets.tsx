import { router, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Card, CardHeader } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { useLocale } from '@/hooks/useLocale';
import { useNow } from '@/hooks/useNow';
import { useToday } from '@/hooks/useToday';
import { SummaryTile } from '@/modules/dashboard/components/SummaryTile';
import { useModules } from '@/state/userSettingsStore';
import { useTheme } from '@/theme';
import { formatShortDate, formatTime, isSameDay } from '@/utils/date';
import { useAlerts, useReminders } from './hooks';
import { notificationsMeta } from './meta';

const openNotifications = () => router.navigate('/notifications');

/** "Próximos avisos": the next alerts of every module (today and tomorrow). */
export function RemindersWidget() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { spacing, colors } = useTheme();
  const today = useToday();
  const now = useNow();
  const modules = useModules();
  const { data, isLoading } = useAlerts(today, 2);
  const upcoming = (data ?? []).filter((a) => new Date(a.at).getTime() > now).slice(0, 5);
  return (
    <Card style={{ flex: 1 }}>
      <CardHeader
        title={t('notifications.widget.title')}
        icon="bell"
        accent={notificationsMeta.accent}
        actionLabel={t('common.viewAll')}
        onAction={openNotifications}
      />
      {isLoading ? (
        <LoadingState />
      ) : !upcoming.length ? (
        <EmptyState
          compact
          icon="bell"
          accent={notificationsMeta.accent}
          title={t('notifications.widget.empty')}
          actionLabel={t('notifications.newReminder')}
          onAction={openNotifications}
        />
      ) : (
        <View style={{ gap: spacing.xs }}>
          {upcoming.map((a) => {
            const at = new Date(a.at);
            const color = a.color ?? modules.find((m) => m.id === a.moduleId)?.accent ?? colors.primary;
            return (
              <Pressable
                key={a.key}
                onPress={() => router.navigate((a.route ?? '/notifications') as Href)}
                accessibilityRole="link"
                accessibilityLabel={`${formatTime(at, locale)}, ${a.title}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 40 }}
              >
                <AppText variant="smallStrong" style={{ width: 64 }}>
                  {isSameDay(at, new Date(now)) ? formatTime(at, locale) : `${formatShortDate(at, locale)}`}
                </AppText>
                <Icon name={a.icon ?? 'bell'} size={15} color={color} />
                <AppText variant="body" numberOfLines={1} style={{ flex: 1 }}>
                  {a.title}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      )}
    </Card>
  );
}

export function NotificationsTodaySummary() {
  const { t } = useTranslation();
  const locale = useLocale();
  const today = useToday();
  const now = useNow();
  const alerts = useAlerts(today, 1);
  const reminders = useReminders();
  const rest = (alerts.data ?? []).filter((a) => new Date(a.at).getTime() > now);
  const overdue = (reminders.data ?? []).filter((r) => !r.done && new Date(r.at).getTime() <= now).length;
  return (
    <SummaryTile
      icon={notificationsMeta.icon}
      accent={notificationsMeta.accent}
      label={t('dashboard.alerts')}
      loading={alerts.isLoading || reminders.isLoading}
      value={rest.length ? t('notifications.summary.upcoming', { count: rest.length }) : t('notifications.summary.none')}
      alert={overdue > 0}
      alertLabel={overdue ? t('notifications.summary.due', { count: overdue }) : undefined}
      details={rest.slice(0, 2).map((a) => `${formatTime(new Date(a.at), locale)} · ${a.title}`)}
      onPress={openNotifications}
    />
  );
}
