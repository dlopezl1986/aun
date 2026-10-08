import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useToast } from '@/components/feedback/ToastProvider';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Divider } from '@/components/ui/Divider';
import { InfoNote } from '@/components/ui/InfoNote';
import { ListRow } from '@/components/ui/ListRow';
import { Toggle } from '@/components/ui/Toggle';
import { useModules, useUserSettings } from '@/state/userSettingsStore';
import { useTheme } from '@/theme';
import { SettingsPage } from '../components/SettingsPage';

export function ModulesSettingsScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const toast = useToast();
  const settings = useUserSettings((s) => s.settings);
  const setEnabled = useUserSettings((s) => s.setModuleEnabled);
  const registry = useModules();
  const modules = registry.filter((m) => m.kind === 'feature');
  const core = registry.filter((m) => m.kind === 'core');

  const onToggle = async (id: string, name: string, enabled: boolean) => {
    await setEnabled(id, enabled);
    toast.show(enabled ? t('settings.modules.enabled', { name }) : t('settings.modules.disabled', { name }), enabled ? 'success' : 'info');
  };

  return (
    <SettingsPage title={t('settings.modules.title')} subtitle={t('settings.modules.subtitle')}>
      <InfoNote title={t('settings.modules.dataSafeTitle')} description={t('settings.modules.dataSafe')} icon="shield" />
      <Card padded={false} style={{ padding: spacing.xs }}>
        {modules.map((m, i) => {
          const name = t(m.titleKey);
          const enabled = settings?.modules[m.id]?.enabled ?? m.defaultEnabled;
          return (
            <View key={m.id}>
              {i > 0 ? <Divider inset={58} /> : null}
              <ListRow
                icon={m.icon}
                accent={m.accent}
                title={name}
                subtitle={t(m.descriptionKey)}
                right={<Toggle value={enabled} label={name} onValueChange={(v) => void onToggle(m.id, name, v)} />}
              />
            </View>
          );
        })}
      </Card>
      <Card padded={false} style={{ padding: spacing.xs }}>
        {core.map((m, i) => (
          <View key={m.id}>
            {i > 0 ? <Divider inset={58} /> : null}
            <ListRow
              icon={m.icon}
              accent={m.accent}
              title={t(m.titleKey)}
              subtitle={t(m.descriptionKey)}
              right={<Badge label={t('settings.modules.alwaysOn')} />}
            />
          </View>
        ))}
      </Card>
      <InfoNote title={t('settings.modules.futureTitle')} description={t('settings.modules.future')} icon="package" />
    </SettingsPage>
  );
}
