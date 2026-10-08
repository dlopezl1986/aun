import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useToast } from '@/components/feedback/ToastProvider';
import { useToday } from '@/hooks/useToday';
import { useAlerts } from '@/modules/notifications/hooks';
import { useNotificationPrefs } from '@/state/userSettingsStore';
import { cancelAll, getPermission, onAlertOpened, scheduleAlerts } from './scheduler';

const IN_APP_HORIZON_MS = 6 * 3_600_000;

/**
 * Keeps the device's scheduled notifications in sync with the alerts of the
 * enabled modules (next 14 days), and shows an in-app toast when an alert is
 * due while AUN is open and the OS won't show it. Mounted once in the shell.
 */
export function useAlertScheduler() {
  const prefs = useNotificationPrefs();
  const today = useToday();
  const alerts = useAlerts(today, 14);
  const toast = useToast();
  const refetch = useRef(alerts.refetch);
  useEffect(() => {
    refetch.current = alerts.refetch;
  }, [alerts.refetch]);
  /** True when the OS/browser shows the alerts itself. */
  const [systemActive, setSystemActive] = useState(false);

  // Tapping a notification opens the related screen.
  useEffect(() => onAlertOpened((route) => router.navigate(route as Href)), []);

  // Coming back to the foreground: recompute (time passed, data may be stale).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void refetch.current());
    return () => sub.remove();
  }, []);

  // System notifications.
  const data = alerts.data;
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    void (async () => {
      const active = prefs.system && (await getPermission()) === 'granted';
      if (!cancelled) setSystemActive(active);
      if (!active) {
        await cancelAll();
        return;
      }
      if (!cancelled) await scheduleAlerts(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [data, prefs.system]);

  // In-app reminder while the app is open (when the OS banner is not shown).
  useEffect(() => {
    if (!data || systemActive) return;
    const now = Date.now();
    const timers = data
      .filter((a) => {
        const t = new Date(a.at).getTime();
        return t > now && t - now < IN_APP_HORIZON_MS;
      })
      .map((a) => setTimeout(() => toast.show(`🔔 ${a.title}${a.body ? ` · ${a.body}` : ''}`, 'info'), new Date(a.at).getTime() - now));
    return () => timers.forEach(clearTimeout);
  }, [data, systemActive, toast]);
}
