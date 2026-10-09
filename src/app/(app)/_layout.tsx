import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppTabBar } from '@/components/layout/navigation/AppTabBar';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { getModuleRegistry } from '@/modules/registry';
import { useAlertScheduler } from '@/services/notifications/useAlertScheduler';
import { useRemoteNotifyPublisher } from '@/services/remoteNotify/hooks';
import { pendingInvite } from '@/services/sharing/pendingInvite';
import { ServicesProvider } from '@/services/ServicesProvider';
import { useAutoSync } from '@/services/sync/useAutoSync';
import { useAuthStore } from '@/state/authStore';
import { useEnabledModules, useUserSettings } from '@/state/userSettingsStore';
import { CanvasScope, useTheme } from '@/theme';

export const unstable_settings = { initialRouteName: 'index' };

/**
 * Authenticated shell. Every module is a tab; the visible navigation
 * (sidebar / bottom bar) is rendered by AppTabBar from the module registry.
 */
function AppTabs() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { hasSidebar } = useBreakpoint();
  const enabled = useEnabledModules();
  const enabledRoutes = useMemo(() => new Set(enabled.map((m) => m.routeName)), [enabled]);

  return (
    <Tabs
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarPosition: hasSidebar ? 'left' : 'bottom',
        sceneStyle: { backgroundColor: colors.background },
        animation: 'none',
      }}
    >
      {getModuleRegistry().map((m) => (
        <Tabs.Screen
          key={m.id}
          name={m.routeName}
          options={{
            title: `${t(m.titleKey)} · AUN`,
            href: enabledRoutes.has(m.routeName) ? undefined : null,
          }}
        />
      ))}
    </Tabs>
  );
}

/** Schedules local notifications for the alerts of the enabled modules. */
function AlertScheduler() {
  useAlertScheduler();
  return null;
}

/** An invitation opened before signing in: show it now. */
function PendingInvite() {
  useEffect(() => {
    void pendingInvite.get().then((code) => {
      if (code) router.push({ pathname: '/join', params: { code } });
    });
  }, []);
  return null;
}

/** Publishes the e-mail / Telegram notices (no-op until a channel is switched on). */
function RemoteNotify() {
  useRemoteNotifyPublisher();
  return null;
}

/** Background sync with the AUN backend (no-op in local-only mode). */
function AutoSync() {
  useAutoSync();
  return null;
}

export default function AppLayout() {
  const userId = useAuthStore((s) => s.session?.user.id);
  const status = useUserSettings((s) => s.status);
  const loadedFor = useUserSettings((s) => s.userId);
  const load = useUserSettings((s) => s.load);
  const { colors } = useTheme();

  useEffect(() => {
    if (userId && loadedFor !== userId) void load(userId, getModuleRegistry());
  }, [userId, loadedFor, load]);

  if (!userId) return null;
  if (status === 'error') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}>
        <CanvasScope>
          <ErrorState onRetry={() => void load(userId, getModuleRegistry())} />
        </CanvasScope>
      </View>
    );
  }
  if (status !== 'ready' || loadedFor !== userId) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}>
        <CanvasScope>
          <LoadingState />
        </CanvasScope>
      </View>
    );
  }

  return (
    <ServicesProvider userId={userId}>
      <AlertScheduler />
      <AutoSync />
      <PendingInvite />
      <RemoteNotify />
      <AppTabs />
    </ServicesProvider>
  );
}
