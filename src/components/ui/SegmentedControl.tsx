import { Pressable, ScrollView, View } from 'react-native';

import { SurfaceScope, useTheme } from '@/theme';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { interaction } from './interaction';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
  count?: number;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
}

/** Horizontally scrollable pill tabs (fits small phones without truncation). */
function SegmentedControlBase<T extends string>({ options, value, onChange, accessibilityLabel }: SegmentedControlProps<T>) {
  const { colors, radius, spacing } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      contentContainerStyle={{ gap: spacing.xs, paddingVertical: 2 }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            aria-selected={active}
            accessibilityLabel={o.count != null ? `${o.label}, ${o.count}` : o.label}
            style={(s) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              minHeight: 36,
              paddingHorizontal: spacing.md,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: active ? colors.primary : colors.border,
              backgroundColor: active ? colors.primary : interaction(s).hovered ? colors.surfaceMuted : colors.surface,
            })}
          >
            {o.icon ? <Icon name={o.icon} size={14} color={active ? colors.onPrimary : colors.textMuted} /> : null}
            <AppText variant="smallStrong" color={active ? colors.onPrimary : colors.text}>
              {o.label}
            </AppText>
            {o.count != null ? (
              <View
                style={{
                  minWidth: 20,
                  paddingHorizontal: 5,
                  borderRadius: radius.pill,
                  backgroundColor: active ? 'rgba(255,255,255,0.22)' : colors.surfaceMuted,
                  alignItems: 'center',
                }}
              >
                <AppText variant="caption" color={active ? colors.onPrimary : colors.textMuted}>
                  {o.count}
                </AppText>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Has its own background: always drawn with the normal (non-canvas) palette. */
export function SegmentedControl<T extends string>(props: SegmentedControlProps<T>) {
  return (
    <SurfaceScope>
      <SegmentedControlBase {...props} />
    </SurfaceScope>
  );
}
