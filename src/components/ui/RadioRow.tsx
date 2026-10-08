import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { hitSize, useTheme, SurfaceScope } from '@/theme';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { interaction } from './interaction';

interface RadioRowProps {
  label: string;
  description?: string;
  selected: boolean;
  onSelect: () => void;
  icon?: IconName;
  disabled?: boolean;
  right?: ReactNode;
}

function RadioRowBase({ label, description, selected, onSelect, icon, disabled, right }: RadioRowProps) {
  const { colors, spacing, radius } = useTheme();
  return (
    <Pressable
      onPress={onSelect}
      disabled={disabled}
      accessibilityRole="radio"
      aria-checked={selected}
      aria-disabled={!!disabled}
      accessibilityLabel={description ? `${label}. ${description}` : label}
      style={(s) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        minHeight: hitSize + 12,
        padding: spacing.md,
        borderRadius: radius.lg,
        borderWidth: 1.5,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.primarySoft : interaction(s).hovered ? colors.surfaceMuted : colors.surface,
        opacity: disabled ? 0.55 : 1,
      })}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          borderWidth: 2,
          borderColor: selected ? colors.primary : colors.borderStrong,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} /> : null}
      </View>
      {icon ? <Icon name={icon} size={20} color={selected ? colors.primary : colors.textMuted} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyStrong">{label}</AppText>
        {description ? (
          <AppText variant="small" tone="textMuted">
            {description}
          </AppText>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

/** Has its own background: always drawn with the normal (non-canvas) palette. */
export function RadioRow(props: RadioRowProps) {
  return (
    <SurfaceScope>
      <RadioRowBase {...props} />
    </SurfaceScope>
  );
}
