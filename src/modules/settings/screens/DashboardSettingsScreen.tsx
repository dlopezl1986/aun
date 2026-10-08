import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { router } from 'expo-router';

import { useDialog } from '@/components/feedback/DialogProvider';
import { useToast } from '@/components/feedback/ToastProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Divider } from '@/components/ui/Divider';
import { IconButton } from '@/components/ui/IconButton';
import { InfoNote } from '@/components/ui/InfoNote';
import { ListRow } from '@/components/ui/ListRow';
import { Toggle } from '@/components/ui/Toggle';
import { useDashboardWidgets, useModules, useUserSettings } from '@/state/userSettingsStore';
import { useDashboardEditMode } from '@/modules/dashboard/editMode';
import { useTheme } from '@/theme';
import { SettingsPage } from '../components/SettingsPage';

/** Show/hide and reorder dashboard widgets (section 9). */
export function DashboardSettingsScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const dialog = useDialog();
  const toast = useToast();
  const widgets = useDashboardWidgets();
  const modules = useModules();
  const setVisible = useUserSettings((s) => s.setWidgetVisible);
  const move = useUserSettings((s) => s.moveWidget);
  const reset = useUserSettings((s) => s.resetDashboard);
  const setEditing = useDashboardEditMode((s) => s.setEditing);

  const onReset = async () => {
    const ok = await dialog.confirm({
      title: t('settings.dashboard.resetTitle'),
      message: t('settings.dashboard.resetMessage'),
      confirmLabel: t('settings.dashboard.reset'),
    });
    if (!ok) return;
    await reset();
    toast.show(t('settings.dashboard.resetDone'));
  };

  return (
    <SettingsPage title={t('settings.dashboard.title')} subtitle={t('settings.dashboard.description')}>
      <InfoNote title={t('settings.dashboard.editInHome')} description={t('settings.dashboard.editInHomeHint')} icon="layout" />
      <Button
        label={t('settings.dashboard.editInHome')}
        icon="sliders"
        variant="soft"
        onPress={() => {
          setEditing(true);
          router.navigate('/');
        }}
      />
      <Card padded={false} style={{ padding: spacing.xs }}>
        {widgets.map(({ definition: w, visible }, i) => {
          const mod = modules.find((m) => m.id === w.moduleId);
          const title = t(w.titleKey);
          return (
            <View key={w.id}>
              {i > 0 ? <Divider inset={58} /> : null}
              <ListRow
                icon={w.icon}
                accent={mod?.accent}
                title={title}
                subtitle={`${mod ? t(mod.titleKey) : ''} · ${t(w.descriptionKey)}`}
                right={
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <IconButton
                      icon="arrow-up"
                      size={16}
                      label={t('settings.dashboard.moveUp', { name: title })}
                      disabled={i === 0}
                      onPress={() => void move(w.id, -1)}
                    />
                    <IconButton
                      icon="arrow-down"
                      size={16}
                      label={t('settings.dashboard.moveDown', { name: title })}
                      disabled={i === widgets.length - 1}
                      onPress={() => void move(w.id, 1)}
                    />
                    <Toggle value={visible} label={title} onValueChange={(v) => void setVisible(w.id, v)} />
                  </View>
                }
              />
            </View>
          );
        })}
      </Card>
      <Button label={t('settings.dashboard.reset')} variant="ghost" icon="rotate-ccw" onPress={() => void onReset()} />
    </SettingsPage>
  );
}
