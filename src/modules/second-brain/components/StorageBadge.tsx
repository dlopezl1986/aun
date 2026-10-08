import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { interaction } from '@/components/ui/interaction';
import { useUserSettings } from '@/state/userSettingsStore';
import { getProviderDescriptor } from '@/storage/providers/descriptors';
import { useTheme, SurfaceScope } from '@/theme';

/** "Almacenamiento actual: Este dispositivo" — links to storage settings. */
function StorageBadgeBase() {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const providerId = useUserSettings((s) => s.settings?.secondBrain.storageProvider ?? 'local');
  const descriptor = getProviderDescriptor(providerId);
  const name = descriptor ? t(descriptor.nameKey) : providerId;
  return (
    <Pressable
      onPress={() => router.navigate('/settings/storage')}
      accessibilityRole="link"
      accessibilityLabel={`${t('secondBrain.storage')}: ${name}. ${t('common.change')}`}
      style={(s) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        alignSelf: 'flex-start',
        paddingVertical: spacing.xs + 2,
        paddingHorizontal: spacing.md,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: interaction(s).hovered ? colors.surfaceMuted : colors.surface,
      })}
    >
      <Icon name={descriptor?.icon ?? 'hard-drive'} size={14} color={colors.textMuted} />
      <AppText variant="small" tone="textMuted">
        {t('secondBrain.storage')}:
      </AppText>
      <AppText variant="smallStrong">{name}</AppText>
      <View style={{ width: 1, height: 14, backgroundColor: colors.border }} />
      <AppText variant="smallStrong" tone="primary">
        {t('common.change')}
      </AppText>
    </Pressable>
  );
}

/** Has its own background: always drawn with the normal (non-canvas) palette. */
export function StorageBadge() {
  return (
    <SurfaceScope>
      <StorageBadgeBase />
    </SurfaceScope>
  );
}
