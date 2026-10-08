import { useState } from 'react';
import { Platform, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useDialog } from '@/components/feedback/DialogProvider';
import { useToast } from '@/components/feedback/ToastProvider';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { InfoNote } from '@/components/ui/InfoNote';
import { RadioRow } from '@/components/ui/RadioRow';
import { useDocumentsByProvider, useRefreshStorage, useStorageConnection } from '@/modules/second-brain/storageHooks';
import { useServices } from '@/services/ServicesProvider';
import { useUserSettings } from '@/state/userSettingsStore';
import {
  getProviderAvailability,
  getProviderDescriptor,
  storageProviderDescriptors,
  type StorageProviderDescriptor,
} from '@/storage/providers/descriptors';
import { StorageProviderError } from '@/storage/providers/errors';
import { getStorageProvider } from '@/storage/providers/factory';
import type { StorageProviderId } from '@/storage/providers/types';
import { useTheme } from '@/theme';
import { SettingsPage } from '../components/SettingsPage';

/** Providers that need an account connection before they can be used. */
const NEEDS_CONNECTION = new Set<StorageProviderId>(['google-drive']);

function ConnectionLine({
  descriptor,
  connected,
  account,
  busy,
  onConnect,
  onDisconnect,
}: {
  descriptor: StorageProviderDescriptor;
  connected: boolean;
  account?: string;
  busy: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: spacing.sm,
        paddingLeft: spacing.huge,
        marginTop: -spacing.xs,
      }}
    >
      <Badge
        label={
          connected ? t('settings.storage.connectedAs', { account: account ?? t(descriptor.nameKey) }) : t('settings.storage.notConnected')
        }
        tone={connected ? 'success' : 'neutral'}
        icon={connected ? 'link' : 'slash'}
      />
      {connected ? (
        <Button label={t('settings.storage.disconnect')} size="sm" variant="ghost" icon="log-out" onPress={onDisconnect} loading={busy} />
      ) : (
        <Button label={t('settings.storage.connect')} size="sm" variant="soft" icon="link" onPress={onConnect} loading={busy} />
      )}
    </View>
  );
}

/**
 * Configuración → 2ndBrain → Almacenamiento (sections 18–23, 55).
 * Exactly ONE active provider. Switching warns that documents are not moved;
 * disconnecting never deletes files.
 */
export function StorageSettingsScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const dialog = useDialog();
  const toast = useToast();
  const { userId } = useServices();
  const current = useUserSettings((s) => s.settings?.secondBrain.storageProvider ?? 'local');
  const setProvider = useUserSettings((s) => s.setStorageProvider);
  const counts = useDocumentsByProvider();
  const refresh = useRefreshStorage();
  const [busy, setBusy] = useState<StorageProviderId | null>(null);

  const driveAvailable = getProviderAvailability(getProviderDescriptor('google-drive')!).available;
  const drive = useStorageConnection('google-drive', driveAvailable);
  const connection = (id: StorageProviderId) => (id === 'google-drive' ? drive.data : { connected: true });

  const reportError = (e: unknown) => {
    const code = e instanceof StorageProviderError ? e.code : 'unknown';
    toast.show(t(`settings.storage.errors.${['not-configured', 'unavailable', 'network'].includes(code) ? code : 'unknown'}`), 'error');
  };

  /** Runs the provider's auth flow. Returns true when connected. */
  const connect = async (id: StorageProviderId): Promise<boolean> => {
    setBusy(id);
    try {
      const result = await getStorageProvider(id, userId).authenticate();
      await refresh();
      if (result.connected) toast.show(t('settings.storage.connectedToast', { account: result.accountLabel ?? '' }));
      return result.connected;
    } catch (e) {
      reportError(e);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async (id: StorageProviderId) => {
    const descriptor = getProviderDescriptor(id);
    const name = descriptor ? t(descriptor.nameKey) : id;
    const ok = await dialog.confirm({
      title: t('settings.storage.disconnectTitle', { provider: name }),
      message: t('settings.storage.disconnectWarning', { provider: name, count: counts.data?.[id] ?? 0 }),
      confirmLabel: t('settings.storage.disconnect'),
      destructive: true,
    });
    if (!ok) return;
    setBusy(id);
    try {
      await getStorageProvider(id, userId).disconnect();
      if (current === id) await setProvider('local');
      await refresh();
      toast.show(
        current === id
          ? t('settings.storage.disconnectedSwitched', { provider: name })
          : t('settings.storage.disconnected', { provider: name }),
        'info',
      );
    } finally {
      setBusy(null);
    }
  };

  const choose = async (id: StorageProviderId) => {
    if (id === current) return;
    if (NEEDS_CONNECTION.has(id) && !connection(id)?.connected) {
      const connected = await connect(id);
      if (!connected) return;
    }
    const from = getProviderDescriptor(current);
    const to = getProviderDescriptor(id);
    const ok = await dialog.confirm({
      title: t('settings.storage.changeTitle', { provider: to ? t(to.nameKey) : id }),
      message: t('settings.storage.changeWarning', { provider: from ? t(from.nameKey) : current }),
      confirmLabel: t('settings.storage.changeConfirm'),
    });
    if (!ok) return;
    await setProvider(id);
    toast.show(t('settings.storage.changed'));
  };

  return (
    <SettingsPage title={t('settings.storage.title')} subtitle={t('settings.storage.question')}>
      <View style={{ gap: spacing.md }} accessibilityRole="radiogroup">
        {storageProviderDescriptors.map((d) => {
          const availability = getProviderAvailability(d);
          const docs = counts.data?.[d.id] ?? 0;
          const conn = connection(d.id);
          return (
            <View key={d.id} style={{ gap: spacing.sm }}>
              <RadioRow
                icon={d.icon}
                label={t(d.nameKey)}
                description={`${t(d.descriptionKey)}${docs ? ` ${t('settings.storage.docsHere', { count: docs })}` : ''}`}
                selected={current === d.id}
                disabled={!availability.available || busy !== null}
                onSelect={() => void choose(d.id)}
                right={
                  availability.available ? (
                    current === d.id ? (
                      <Badge label={t('settings.storage.active')} tone="success" />
                    ) : null
                  ) : (
                    <Badge label={t(availability.reasonKey)} tone="neutral" />
                  )
                }
              />
              {availability.available && NEEDS_CONNECTION.has(d.id) ? (
                <ConnectionLine
                  descriptor={d}
                  connected={!!conn?.connected}
                  account={conn && 'accountLabel' in conn ? conn.accountLabel : undefined}
                  busy={busy === d.id}
                  onConnect={() => void connect(d.id)}
                  onDisconnect={() => void disconnect(d.id)}
                />
              ) : null}
            </View>
          );
        })}
      </View>

      <InfoNote title={t('settings.storage.oneProviderTitle')} description={t('settings.storage.oneProvider')} icon="info" />
      {driveAvailable && Platform.OS === 'web' ? (
        <InfoNote title={t('settings.storage.webSessionTitle')} description={t('settings.storage.webSession')} icon="shield" />
      ) : null}
      {!driveAvailable ? (
        <InfoNote title={t('settings.storage.driveSetupTitle')} description={t('settings.storage.driveSetup')} icon="tool" tone="warning" />
      ) : null}
      {Platform.OS !== 'ios' ? (
        <InfoNote
          title={t('settings.storage.icloudTitle')}
          description={t('settings.storage.icloudPlatform')}
          icon="cloud"
          tone="warning"
        />
      ) : null}
      <InfoNote
        title={t('settings.storage.roadmapTitle')}
        items={[t('settings.storage.roadmapICloud'), t('settings.storage.roadmapMigrate'), t('settings.storage.roadmapAndroid')]}
      />
      <AppText variant="small" tone="textSubtle">
        {t('settings.storage.security')}
      </AppText>
    </SettingsPage>
  );
}
