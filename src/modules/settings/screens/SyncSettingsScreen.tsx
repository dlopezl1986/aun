import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useDialog } from '@/components/feedback/DialogProvider';
import { useToast } from '@/components/feedback/ToastProvider';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { InfoNote } from '@/components/ui/InfoNote';
import { ListRow } from '@/components/ui/ListRow';
import { LoadingState } from '@/components/ui/States';
import { useLocale } from '@/hooks/useLocale';
import { getModuleRegistry } from '@/modules/registry';
import { authGateway, localAccounts } from '@/services/auth';
import { isBackendConfigured } from '@/services/backend';
import { useServices } from '@/services/ServicesProvider';
import { migrateLocalData, summarizeLocalData } from '@/services/sync/migration';
import { useSyncNow, useSyncStatus } from '@/services/sync/useAutoSync';
import { useUserSettings } from '@/state/userSettingsStore';
import { asyncKeyValueStore } from '@/storage/keyValueStore';
import { useTheme } from '@/theme';
import { formatShortDate, formatTime } from '@/utils/date';
import { SettingsPage } from '../components/SettingsPage';

/** Settings → Cuenta y sincronización (Phase 9). */
export function SyncSettingsScreen() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { spacing } = useTheme();
  const toast = useToast();
  const dialog = useDialog();
  const services = useServices();
  const client = useQueryClient();
  const status = useSyncStatus();
  const syncNow = useSyncNow();
  const reloadSettings = useUserSettings((s) => s.load);
  const [migrating, setMigrating] = useState<string | null>(null);

  const state = useQuery({
    queryKey: ['u', services.userId, 'sync-state', status.last?.at, status.running],
    enabled: !!services.sync,
    queryFn: async () => ({ state: await services.sync!.getState(), pending: (await services.sync!.pending()).length }),
  });

  // Local (device-only) accounts whose data can be copied into this account.
  const local = useQuery({
    queryKey: ['u', services.userId, 'local-accounts'],
    enabled: !authGateway.isLocalOnly,
    queryFn: async () => {
      const users = (await localAccounts.listLocalUsers()).filter((u) => u.id !== services.userId);
      return Promise.all(users.map(async (u) => ({ user: u, summary: await summarizeLocalData(asyncKeyValueStore, u.id) })));
    },
  });

  const copy = async (userId: string, email: string) => {
    const ok = await dialog.confirm({
      title: t('settings.sync.migrateTitle', { email }),
      message: t('settings.sync.migrateMessage'),
      confirmLabel: t('settings.sync.migrate'),
    });
    if (!ok) return;
    setMigrating(userId);
    try {
      const r = await migrateLocalData(asyncKeyValueStore, userId, services);
      await reloadSettings(services.userId, getModuleRegistry());
      await client.invalidateQueries({ queryKey: ['u', services.userId] });
      toast.show(t('settings.sync.migrated', { count: r.rows }), 'success');
      if (r.failedFiles) toast.show(t('settings.sync.migratedFilesFailed', { count: r.failedFiles }), 'error');
      void syncNow();
    } catch {
      toast.show(t('common.errorDescription'), 'error');
    } finally {
      setMigrating(null);
    }
  };

  const when = (iso: string | null | undefined) =>
    iso ? `${formatShortDate(new Date(iso), locale)} · ${formatTime(new Date(iso), locale)}` : t('settings.sync.never');

  return (
    <SettingsPage title={t('settings.sync.title')} subtitle={t('settings.sync.subtitle')}>
      {!isBackendConfigured ? (
        <>
          <Card>
            <CardHeader title={t('settings.sync.localTitle')} icon="smartphone" />
            <AppText variant="body" tone="textMuted">
              {t('settings.sync.localDescription')}
            </AppText>
          </Card>
          <InfoNote
            title={t('settings.sync.howTitle')}
            items={[t('settings.sync.howBackend'), t('settings.sync.howMigrate'), t('settings.sync.howPrivacy')]}
          />
        </>
      ) : (
        <>
          <Card>
            <CardHeader
              title={t('settings.sync.statusTitle')}
              icon="refresh-cw"
              right={
                status.running ? (
                  <Badge label={t('settings.sync.running')} tone="info" />
                ) : status.error || state.data?.state.lastError ? (
                  <Badge label={t(`settings.sync.errors.${status.error ?? 'server'}`)} tone="danger" />
                ) : (
                  <Badge label={t('settings.sync.ok')} tone="success" />
                )
              }
            />
            {state.isLoading ? (
              <LoadingState />
            ) : (
              <View style={{ gap: spacing.xs }}>
                <ListRow icon="clock" title={t('settings.sync.lastSync')} subtitle={when(state.data?.state.lastSyncAt)} />
                <ListRow
                  icon="upload-cloud"
                  title={t('settings.sync.pending')}
                  subtitle={t('settings.sync.pendingCount', { count: state.data?.pending ?? 0 })}
                />
              </View>
            )}
            <Button
              label={t('settings.sync.now')}
              icon="refresh-cw"
              variant="secondary"
              loading={status.running}
              onPress={async () => {
                const r = await syncNow();
                if (r) toast.show(t('settings.sync.done', { pushed: r.pushed, pulled: r.pulled }), 'success');
                else toast.show(t(`settings.sync.errors.${useSyncStatus.getState().error ?? 'server'}`), 'error');
              }}
              style={{ alignSelf: 'flex-start', marginTop: spacing.md }}
            />
          </Card>

          {local.data?.some((l) => l.summary.rows > 0) ? (
            <Card>
              <CardHeader title={t('settings.sync.migrateCard')} icon="download" />
              <AppText variant="small" tone="textMuted" style={{ marginBottom: spacing.sm }}>
                {t('settings.sync.migrateHint')}
              </AppText>
              {local.data
                .filter((l) => l.summary.rows > 0)
                .map((l) => (
                  <ListRow
                    key={l.user.id}
                    icon="user"
                    title={l.user.email}
                    subtitle={t('settings.sync.localRows', { count: l.summary.rows })}
                    right={
                      <Button
                        label={t('settings.sync.migrate')}
                        size="sm"
                        variant="secondary"
                        loading={migrating === l.user.id}
                        onPress={() => void copy(l.user.id, l.user.email)}
                      />
                    }
                  />
                ))}
            </Card>
          ) : null}

          <InfoNote
            title={t('settings.sync.howTitle')}
            items={[
              t('settings.sync.howOffline'),
              t('settings.sync.howConflicts'),
              t('settings.sync.howFiles'),
              t('settings.sync.howPrivacy'),
            ]}
          />
        </>
      )}
    </SettingsPage>
  );
}
