import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useToday } from '@/hooks/useToday';
import { useAlerts } from '@/modules/notifications/hooks';
import { useServices } from '@/services/ServicesProvider';
import { useDataMutation, useDataQuery } from '@/state/queryClient';
import { addDays, fromDateKey, toDateKey } from '@/utils/date';
import { buildDigest } from './digest';
import type { NotifySettings } from './firebaseNotify';

const DIGEST_DAYS = 7;
const PUBLISH_DELAY_MS = 4_000;

export function useNotifySettings() {
  const { i18n } = useTranslation();
  return useDataQuery('notify', ['settings'], (s) => (s.notify ? s.notify.get(i18n.language) : Promise.resolve(null)));
}

export function useSaveNotifySettings() {
  const { t, i18n } = useTranslation();
  return useDataMutation(
    (s, patch: Partial<Omit<NotifySettings, 'telegramChatId' | 'telegramName'>>) => s.notify!.save(patch, i18n.language),
    { invalidate: ['notify'], successMessage: t('common.saved') },
  );
}

/**
 * Publishes what the notifier must send (alerts for Telegram, the daily
 * summaries) whenever the user's data changes. Mounted once in the app shell;
 * does nothing until a channel is switched on.
 */
export function useRemoteNotifyPublisher() {
  const services = useServices();
  const { t, i18n } = useTranslation();
  const today = useToday();
  const settings = useNotifySettings().data;
  const alerts = useAlerts(today, 14).data;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const notify = services.notify;
    if (!notify || !settings || !alerts) return;
    const telegramAlerts = !!settings.telegramChatId && settings.telegramAlerts;
    const daily = settings.emailDaily || (!!settings.telegramChatId && settings.telegramDaily);
    if (timer.current) clearTimeout(timer.current);
    // Debounced: data changes come in bursts (sync, several edits).
    timer.current = setTimeout(() => {
      void (async () => {
        try {
          await notify.publishAlerts(telegramAlerts ? alerts : []);
          if (daily) {
            const days = Array.from({ length: DIGEST_DAYS }, (_, i) => toDateKey(addDays(fromDateKey(today), i)));
            const digests = await Promise.all(days.map((d) => buildDigest(services, d, i18n.language, t)));
            await notify.publishDigests(digests);
          }
        } catch {
          // Offline / no permission: next change or app start tries again.
        }
      })();
    }, PUBLISH_DELAY_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [services, settings, alerts, today, t, i18n.language]);
}
