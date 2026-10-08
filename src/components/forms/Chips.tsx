import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';

export interface ChipOption<T> {
  value: T;
  label: string;
}

interface ChipGroupProps<T> {
  options: ChipOption<T>[];
  /** Single value or list (multi-select). */
  selected: T | T[];
  onToggle: (value: T) => void;
  accessibilityLabel: string;
  multi?: boolean;
  color?: string;
  compact?: boolean;
}

/** Wrapping chip selector used across forms (single or multiple choice). */
export function ChipGroup<T extends string | number>({
  options,
  selected,
  onToggle,
  accessibilityLabel,
  multi,
  color,
  compact,
}: ChipGroupProps<T>) {
  const { colors, spacing, radius } = useTheme();
  const accent = color ?? colors.primary;
  const isOn = (v: T) => (Array.isArray(selected) ? selected.includes(v) : selected === v);
  return (
    <View
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}
      accessibilityRole={multi ? undefined : 'radiogroup'}
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((o) => {
        const active = isOn(o.value);
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onToggle(o.value)}
            accessibilityRole={multi ? 'checkbox' : 'radio'}
            aria-checked={active}
            accessibilityLabel={o.label}
            style={{
              minHeight: compact ? 30 : 34,
              minWidth: compact ? 34 : undefined,
              justifyContent: 'center',
              alignItems: 'center',
              paddingHorizontal: compact ? spacing.sm : spacing.md,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: active ? accent : colors.border,
              backgroundColor: active ? withAlpha(accent, 0.12) : 'transparent',
            }}
          >
            <AppText variant="caption" color={active ? accent : colors.textMuted}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
