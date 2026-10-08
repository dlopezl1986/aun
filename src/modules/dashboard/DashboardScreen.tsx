import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useDialog } from '@/components/feedback/DialogProvider';
import { useToast } from '@/components/feedback/ToastProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { InfoNote } from '@/components/ui/InfoNote';
import { EmptyState } from '@/components/ui/States';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useLocale } from '@/hooks/useLocale';
import { useNotificationBadge } from '@/modules/notifications/hooks';
import { useServices } from '@/services/ServicesProvider';
import { useAuthStore } from '@/state/authStore';
import { useDashboardWidgets, useUserSettings } from '@/state/userSettingsStore';
import { formatLongDate, greetingKey } from '@/utils/date';
import { GlobalSearch } from './components/GlobalSearch';
import { HiddenWidgets } from './components/HiddenWidgets';
import { WidgetGrid } from './components/WidgetGrid';
import { useDashboardEditMode } from './editMode';

const greetingEmoji = { morning: '☀️', afternoon: '🌤️', evening: '🌙' } as const;

export function DashboardScreen() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { isCompact } = useBreakpoint();
  const dialog = useDialog();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { userId } = useServices();
  const user = useAuthStore((s) => s.session?.user);
  const widgets = useDashboardWidgets();
  const badge = useNotificationBadge();
  const moveWidget = useUserSettings((s) => s.moveWidget);
  const setWidgetSize = useUserSettings((s) => s.setWidgetSize);
  const setWidgetVisible = useUserSettings((s) => s.setWidgetVisible);
  const resetDashboard = useUserSettings((s) => s.resetDashboard);
  const editing = useDashboardEditMode((s) => s.editing);
  const setEditing = useDashboardEditMode((s) => s.setEditing);

  const visible = useMemo(() => widgets.filter((w) => w.visible), [widgets]);
  const hidden = useMemo(() => widgets.filter((w) => !w.visible), [widgets]);
  const greeting = greetingKey();
  const firstName = user?.displayName.split(' ')[0] ?? '';

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['u', userId] });

  const hide = async (id: string) => {
    await setWidgetVisible(id, false);
    toast.show(t('dashboard.edit.hidden'), 'info');
  };

  const reset = async () => {
    const ok = await dialog.confirm({
      title: t('settings.dashboard.resetTitle'),
      message: t('settings.dashboard.resetMessage'),
      confirmLabel: t('settings.dashboard.reset'),
    });
    if (!ok) return;
    await resetDashboard();
    toast.show(t('settings.dashboard.resetDone'));
  };

  const actions = editing ? (
    <>
      <Button label={t('settings.dashboard.reset')} variant="ghost" icon="rotate-ccw" onPress={() => void reset()} />
      <Button label={t('dashboard.edit.done')} icon="check" onPress={() => setEditing(false)} />
    </>
  ) : (
    <>
      <IconButton
        icon="bell"
        label={t('modules.notifications.title')}
        badge={badge}
        variant="surface"
        onPress={() => router.navigate('/notifications')}
      />
      <Button
        label={isCompact ? t('dashboard.customizeShort') : t('dashboard.customize')}
        variant="secondary"
        icon="sliders"
        onPress={() => setEditing(true)}
      />
    </>
  );

  return (
    <Screen onRefresh={refresh}>
      <PageHeader
        title={
          editing ? t('dashboard.edit.title') : `${t(`dashboard.greeting.${greeting}`, { name: firstName })} ${greetingEmoji[greeting]}`
        }
        subtitle={editing ? t('dashboard.edit.subtitle') : formatLongDate(new Date(), locale)}
        actions={actions}
      />

      {editing ? null : <GlobalSearch />}

      {visible.length ? (
        <WidgetGrid
          widgets={visible}
          editing={editing}
          onMove={(id, d) => void moveWidget(id, d, true)}
          onResize={(id, size) => void setWidgetSize(id, size)}
          onHide={(id) => void hide(id)}
        />
      ) : (
        <Card>
          <EmptyState
            icon="layout"
            title={t('dashboard.emptyTitle')}
            description={t('dashboard.emptyDescription')}
            actionLabel={editing ? undefined : t('dashboard.customize')}
            onAction={editing ? undefined : () => setEditing(true)}
          />
        </Card>
      )}

      {editing ? (
        <>
          <HiddenWidgets widgets={hidden} onShow={(id) => void setWidgetVisible(id, true)} />
          <InfoNote title={t('dashboard.edit.tipTitle')} description={t('dashboard.edit.tip')} icon="info" />
        </>
      ) : null}
    </Screen>
  );
}
