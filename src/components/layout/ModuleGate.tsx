import type { PropsWithChildren } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';
import { useIsModuleEnabled, useModules, useUserSettings } from '@/state/userSettingsStore';
import { CanvasScope, useTheme } from '@/theme';

/**
 * Protects a module's routes: when the module is disabled (e.g. reached via
 * deep link or browser URL) we explain it and offer to re-enable it.
 * Its data is untouched.
 */
export function ModuleGate({ moduleId, children }: PropsWithChildren<{ moduleId: string }>) {
  const enabled = useIsModuleEnabled(moduleId);
  const setEnabled = useUserSettings((s) => s.setModuleEnabled);
  const modules = useModules();
  const { colors } = useTheme();
  const { t } = useTranslation();
  if (enabled) return <>{children}</>;

  const mod = modules.find((m) => m.id === moduleId);
  const name = mod ? t(mod.titleKey) : moduleId;
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}>
      <CanvasScope>
        <EmptyState
          icon="eye-off"
          accent={mod?.accent}
          title={t('modules.disabledTitle', { name })}
          description={t('modules.disabledDescription')}
          actionLabel={t('modules.enable', { name })}
          onAction={() => void setEnabled(moduleId, true)}
          secondary={
            <Button label={t('modules.goHome')} variant="ghost" onPress={() => router.navigate('/')} style={{ alignSelf: 'center' }} />
          }
        />
      </CanvasScope>
    </View>
  );
}
