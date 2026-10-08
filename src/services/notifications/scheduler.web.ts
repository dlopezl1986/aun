import type { AlertItem } from '@/types/module';

/**
 * Web: the browser Notifications API. Without a push server, notifications
 * can only fire while an AUN tab is open, so only the next 24 h are kept as
 * in-page timers (re-armed on every data change). The UI says so.
 */
export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

const HORIZON_MS = 24 * 3_600_000;
let timers: ReturnType<typeof setTimeout>[] = [];
let opener: ((route: string) => void) | null = null;

const supported = () => typeof window !== 'undefined' && 'Notification' in window;

export async function getPermission(): Promise<PermissionState> {
  if (!supported()) return 'unsupported';
  return Notification.permission === 'granted' ? 'granted' : Notification.permission === 'denied' ? 'denied' : 'undetermined';
}

export async function requestPermission(): Promise<PermissionState> {
  if (!supported()) return 'unsupported';
  const result = await Notification.requestPermission();
  return result === 'granted' ? 'granted' : result === 'denied' ? 'denied' : 'undetermined';
}

export async function cancelAll(): Promise<void> {
  timers.forEach(clearTimeout);
  timers = [];
}

export async function scheduleAlerts(alerts: AlertItem[]): Promise<number> {
  await cancelAll();
  if (!supported() || Notification.permission !== 'granted') return 0;
  const now = Date.now();
  const upcoming = alerts.filter((a) => {
    const t = new Date(a.at).getTime();
    return t > now && t - now <= HORIZON_MS;
  });
  for (const a of upcoming) {
    timers.push(
      setTimeout(
        () => {
          const n = new Notification(a.title, { body: a.body, tag: a.key, icon: '/favicon.ico' });
          n.onclick = () => {
            window.focus();
            if (a.route) opener?.(a.route);
            n.close();
          };
        },
        new Date(a.at).getTime() - now,
      ),
    );
  }
  return upcoming.length;
}

export function onAlertOpened(open: (route: string) => void): () => void {
  opener = open;
  return () => {
    if (opener === open) opener = null;
  };
}
