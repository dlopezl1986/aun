import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Platform, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { Divider } from '@/components/ui/Divider';
import { ListRow } from '@/components/ui/ListRow';
import { useSignOut } from '@/hooks/useSignOut';
import { SUPPORTED_LANGUAGES } from '@/i18n/languages';
import { authGateway } from '@/services/auth';
import { useAppPreferences } from '@/state/appPreferences';
import { useAuthStore } from '@/state/authStore';
import { isBackendConfigured } from '@/services/backend';
import { useEnabledModules, useNotificationPrefs, useUserSettings } from '@/state/userSettingsStore';
import { getProviderDescriptor } from '@/storage/providers/descriptors';
import { useTheme } from '@/theme';
import { DangerZone } from '../components/DangerZone';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="overline" tone="textMuted" style={{ marginLeft: spacing.xs }}>
        {title}
      </AppText>
      <Card padded={false} style={{ padding: spacing.xs }}>
        {children}
      </Card>
    </View>
  );
}

export function SettingsHomeScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const user = useAuthStore((s) => s.session?.user);
  const signOut = useSignOut();
  const language = useAppPreferences((s) => s.language);
  const themeMode = useAppPreferences((s) => s.themeMode);
  const enabled = useEnabledModules().filter((m) => m.kind === 'feature');
  const storage = useUserSettings((s) => s.settings?.secondBrain.storageProvider ?? 'local');
  const notificationPrefs = useNotificationPrefs();
  const storageDescriptor = getProviderDescriptor(storage);
  const go = (path: Parameters<typeof router.push>[0]) => router.push(path);

  return (
    <Screen maxWidth={760}>
      <PageHeader title={t('modules.settings.title')} subtitle={t('settings.subtitle')} icon="settings" accent="#64748B" />

      {user ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
            <Avatar name={user.displayName} size={52} />
            <View style={{ flex: 1 }}>
              <AppText variant="heading">{user.displayName}</AppText>
              <AppText variant="small" tone="textMuted">
                {user.email}
              </AppText>
            </View>
          </View>
        </Card>
      ) : null}

      <Section title={t('settings.sections.account')}>
        <ListRow
          icon="user"
          title={t('settings.profile.title')}
          subtitle={t('settings.profile.subtitle')}
          chevron
          onPress={() => go('/settings/profile')}
        />
      </Section>

      <Section title={t('settings.sections.general')}>
        <ListRow
          icon="grid"
          title={t('settings.modules.title')}
          subtitle={t('settings.modules.summary', { count: enabled.length })}
          chevron
          onPress={() => go('/settings/modules')}
        />
        <Divider inset={58} />
        <ListRow
          icon="layout"
          title={t('settings.dashboard.title')}
          subtitle={t('settings.dashboard.subtitle')}
          chevron
          onPress={() => go('/settings/dashboard')}
        />
        <Divider inset={58} />
        <ListRow
          icon="bell"
          title={t('notifications.settings.title')}
          subtitle={notificationPrefs.system ? t('notifications.settings.on') : t('notifications.settings.off')}
          chevron
          onPress={() => go('/settings/notifications')}
        />
        <Divider inset={58} />
        <ListRow
          icon="globe"
          title={t('settings.language.title')}
          subtitle={SUPPORTED_LANGUAGES.find((l) => l.code === language)?.nativeName}
          chevron
          onPress={() => go('/settings/language')}
        />
        <Divider inset={58} />
        <ListRow
          icon="sun"
          title={t('settings.appearance.title')}
          subtitle={t(`settings.appearance.${themeMode}`)}
          chevron
          onPress={() => go('/settings/appearance')}
        />
      </Section>

      <Section title={t('modules.secondBrain.title')}>
        <ListRow
          icon="hard-drive"
          title={t('settings.storage.title')}
          subtitle={storageDescriptor ? t(storageDescriptor.nameKey) : storage}
          chevron
          onPress={() => go('/settings/storage')}
        />
        <Divider inset={58} />
        <ListRow
          icon="refresh-cw"
          title={t('settings.sync.title')}
          subtitle={isBackendConfigured ? t('settings.sync.summaryCloud') : t('settings.sync.summaryLocal')}
          chevron
          onPress={() => go('/settings/sync')}
        />
      </Section>

      <Section title={t('settings.sections.about')}>
        <ListRow
          icon="info"
          title="AUN · All You Need"
          subtitle={`${t('settings.version')} ${Constants.expoConfig?.version ?? '—'} · ${Platform.OS}`}
        />
        {authGateway.isLocalOnly ? (
          <>
            <Divider inset={58} />
            <ListRow icon="smartphone" title={t('settings.localData.title')} subtitle={t('settings.localData.description')} />
          </>
        ) : null}
      </Section>

      <Card padded={false} style={{ padding: spacing.xs }}>
        <ListRow icon="log-out" title={t('auth.signOut')} destructive onPress={() => void signOut()} />
      </Card>

      <View style={{ gap: spacing.sm }}>
        <AppText variant="overline" tone="danger" style={{ marginLeft: spacing.xs }}>
          {t('settings.danger.title')}
        </AppText>
        <DangerZone />
      </View>
    </Screen>
  );
}
