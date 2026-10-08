import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';

interface BrandMarkProps {
  compact?: boolean;
  /** Text colour context: on the dark sidebar or on a light surface. */
  onDark?: boolean;
  size?: number;
}

/** AUN logo: a stacked "layers" mark (modules) + wordmark. */
export function BrandMark({ compact, onDark, size = 34 }: BrandMarkProps) {
  const { colors, spacing } = useTheme();
  const bar = (w: number, o: number) => (
    <View style={{ width: w, height: size * 0.12, borderRadius: size, backgroundColor: `rgba(255,255,255,${o})` }} />
  );
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
      accessibilityRole="header"
      accessibilityLabel="AUN — All You Need"
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.3,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          gap: size * 0.07,
          boxShadow: `0px 6px 16px ${withAlpha(colors.primary, 0.35)}`,
        }}
      >
        {bar(size * 0.52, 1)}
        {bar(size * 0.38, 0.8)}
        {bar(size * 0.24, 0.6)}
      </View>
      {compact ? null : (
        <View>
          <AppText variant="heading" color={onDark ? colors.sidebarText : colors.text} style={{ letterSpacing: 1.5, lineHeight: 20 }}>
            AUN
          </AppText>
          <AppText variant="overline" color={onDark ? colors.sidebarTextMuted : colors.textMuted} style={{ fontSize: 9, lineHeight: 11 }}>
            All You Need
          </AppText>
        </View>
      )}
    </View>
  );
}
