import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { hitSize, useTheme } from '@/theme';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { interaction } from './interaction';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  color?: string;
  right?: ReactNode;
  disabled?: boolean;
  /** Strike through and dim the label when checked (to-do style). */
  completedStyle?: boolean;
}

/** Checkbox row with a full-width touch target. */
export function Checkbox({ checked, onChange, label, description, color, right, disabled, completedStyle }: CheckboxProps) {
  const done = checked && completedStyle;
  const { colors, radius, spacing } = useTheme();
  const accent = color ?? colors.primary;
  // `right` (e.g. a delete button) is a sibling of the pressable, never nested:
  // nested buttons are invalid on web and confusing for screen readers.
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <Pressable
        onPress={() => onChange(!checked)}
        disabled={disabled}
        accessibilityRole="checkbox"
        aria-checked={checked}
        aria-disabled={!!disabled}
        accessibilityLabel={label}
        style={(s) => ({
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          minHeight: hitSize,
          paddingHorizontal: spacing.xs,
          borderRadius: radius.sm,
          backgroundColor: interaction(s).hovered ? colors.surfaceMuted : 'transparent',
          opacity: disabled ? 0.5 : 1,
        })}
      >
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: radius.xs + 1,
            borderWidth: 1.5,
            borderColor: checked ? accent : colors.borderStrong,
            backgroundColor: checked ? accent : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {checked ? <Icon name="check" size={14} color="#FFFFFF" /> : null}
        </View>
        <View style={{ flex: 1, paddingVertical: spacing.xs }}>
          <AppText
            variant="body"
            tone={done ? 'textSubtle' : 'text'}
            style={done ? { textDecorationLine: 'line-through' } : undefined}
            numberOfLines={2}
          >
            {label}
          </AppText>
          {description ? (
            <AppText variant="small" tone="textMuted" numberOfLines={1}>
              {description}
            </AppText>
          ) : null}
        </View>
      </Pressable>
      {right}
    </View>
  );
}
