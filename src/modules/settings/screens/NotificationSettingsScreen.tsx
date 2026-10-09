import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { TimeField } from '@/components/forms/DateTimeFields';
import { useToast } from '@/components/feedback/ToastProvider';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Divider } from '@/components/ui/Divider';
import { InfoNote } from '@/components/ui/InfoNote';
import { ListRow } from '@/components/ui/ListRow';
import { Toggle } from '@/components/ui/Toggle';
import { getPermission, requestPermission, type PermissionState } from '@/services/notifications/scheduler';
import { useEnabledModules, useNotificationPrefs, useUserSettings } from '@/state/userSettingsStore';
import { useTheme } from '@/theme';
import { RemoteNotifySettings } from '../components/RemoteNotifySettings';
import { SettingsPage } from '../components/SettingsPage';

/** Settings → Notificaciones: device permission, sources and times. */
export function NotificationSettingsScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const toast = useToast();
  const prefs = useNotificationPrefs();
  const setPrefs = useUserSettings((s) => s.setNotificationPrefs);
  const modules = useEnabledModules();
  const [permission, setPermission] = useState<PermissionState | null>(null);

  useEffect(() => {
    let alive = true;
    void getPermission().then((p) => alive && setPermission(p));
    return () => {
      alive = false;
    };
  }, []);

  const toggleSystem = async (on: boolean) => {
    if (!on) {
      await setPrefs({ system: false });
      return;
    }
    const p = permission === 'granted' ? 'granted' : await requestPermission();
    setPermission(p);
    if (p === 'granted') {
      await setPrefs({ system: true });
      toast.show(t('notifications.settings.enabled'), 'success');
    } else toast.show(t(`notifications.settings.permission.${p}`), 'error');
  };

  const sources = modules.flatMap((m) => (m.alerts ?? []).map((s) => ({ module: m, source: s })));

  return (
    <SettingsPage title={t('notifications.settings.title')} subtitle={t('notifications.settings.subtitle')}>
      <Card padded={false} style={{ padding: spacing.xs }}>
        <ListRow
          icon="bell"
          accent="#E5484D"
          title={t('notifications.settings.system')}
          subtitle={t(Platform.OS === 'web' ? 'notifications.settings.systemHintWeb' : 'notifications.settings.systemHint')}
          right={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              {permission && permission !== 'granted' && permission !== 'undetermined' ? (
                <Badge label={t(`notifications.settings.permissionShort.${permission}`)} tone="warning" />
              ) : null}
              <Toggle
                label={t('notifications.settings.system')}
                value={prefs.system && permission === 'granted'}
                onValueChange={(v) => void toggleSystem(v)}
              />
            </View>
          }
        />
      </Card>

      <RemoteNotifySettings />
      {permission === 'denied' ? (
        <InfoNote
          tone="warning"
          icon="alert-triangle"
          title={t('notifications.settings.deniedTitle')}
          description={t('notifications.settings.denied')}
        />
      ) : null}

      <AppText variant="overline" tone="textMuted" style={{ marginLeft: spacing.xs }}>
        {t('notifications.settings.sources')}
      </AppText>
      <Card padded={false} style={{ padding: spacing.xs }}>
        {sources.map(({ module, source }, i) => (
          <View key={source.id}>
            {i > 0 ? <Divider inset={58} /> : null}
            <ListRow
              icon={source.icon}
              accent={module.accent}
              title={t(source.labelKey)}
              subtitle={`${t(module.titleKey)} · ${t(source.descriptionKey)}`}
              right={
                <Toggle
                  label={t(source.labelKey)}
                  value={prefs.sources[source.id] !== false}
                  onValueChange={(v) => void setPrefs({ sources: { ...prefs.sources, [source.id]: v } })}
                />
              }
            />
          </View>
        ))}
      </Card>

      {modules.some((m) => m.id === 'family') ? (
        <Card>
          <TimeField
            label={t('notifications.settings.tomorrowTime')}
            value={prefs.tomorrowTime}
            onChange={(v) => void setPrefs({ tomorrowTime: v })}
          />
          <AppText variant="small" tone="textMuted" style={{ marginTop: spacing.xs }}>
            {t('notifications.settings.tomorrowTimeHint')}
          </AppText>
        </Card>
      ) : null}

      <InfoNote
        title={t('notifications.settings.howTitle')}
        items={[t('notifications.settings.howLocal'), t('notifications.settings.howDisabled'), t('notifications.settings.howEmail')]}
      />
    </SettingsPage>
  );
}
