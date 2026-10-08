import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { AlertItem } from '@/types/module';

/**
 * iOS/Android: local notifications scheduled on the device (no server, no
 * push token). iOS keeps at most 64 pending notifications, so only the next
 * MAX_SCHEDULED alerts are scheduled; the list is rebuilt whenever data
 * changes or the app returns to the foreground.
 */
export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

const MAX_SCHEDULED = 50;
const CHANNEL = 'reminders';
let configured = false;

function configure() {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync(CHANNEL, { name: 'AUN', importance: Notifications.AndroidImportance.HIGH });
  }
}

const mapStatus = (s: { granted: boolean; canAskAgain?: boolean; status: string }): PermissionState =>
  s.granted ? 'granted' : s.status === 'undetermined' || s.canAskAgain ? 'undetermined' : 'denied';

export async function getPermission(): Promise<PermissionState> {
  try {
    return mapStatus(await Notifications.getPermissionsAsync());
  } catch {
    return 'unsupported';
  }
}

export async function requestPermission(): Promise<PermissionState> {
  try {
    configure();
    return mapStatus(await Notifications.requestPermissionsAsync());
  } catch {
    return 'unsupported';
  }
}

export async function cancelAll(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Nothing scheduled / unsupported.
  }
}

/** Replaces every scheduled notification with the next alerts. Returns how many were scheduled. */
export async function scheduleAlerts(alerts: AlertItem[]): Promise<number> {
  configure();
  await cancelAll();
  const now = Date.now() + 5_000;
  const upcoming = alerts.filter((a) => new Date(a.at).getTime() > now).slice(0, MAX_SCHEDULED);
  for (const a of upcoming) {
    await Notifications.scheduleNotificationAsync({
      identifier: a.key.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 120),
      content: { title: a.title, body: a.body ?? undefined, data: { route: a.route ?? '/notifications' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(a.at), channelId: CHANNEL },
    });
  }
  return upcoming.length;
}

/** Calls `open(route)` when the user taps a notification (also the one that launched the app). */
export function onAlertOpened(open: (route: string) => void): () => void {
  configure();
  const handle = (r: Notifications.NotificationResponse | null) => {
    const route = r?.notification.request.content.data?.route;
    if (typeof route === 'string') open(route);
  };
  void Notifications.getLastNotificationResponseAsync().then(handle);
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}
