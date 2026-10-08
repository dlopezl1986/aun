import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { hitSize, useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { interaction } from './interaction';

interface ListRowProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  accent?: string;
  /** Leading custom element (avatar, colour dot…) instead of an icon tile. */
  leading?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  destructive?: boolean;
  accessibilityHint?: string;
}

export function ListRow({ title, subtitle, icon, accent, leading, right, onPress, chevron, destructive, accessibilityHint }: ListRowProps) {
  const { colors, radius, spacing } = useTheme();
  const color = destructive ? colors.danger : (accent ?? colors.textMuted);
  const content = (
    <>
      {leading ??
        (icon ? (
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: accent || destructive ? withAlpha(color, 0.12) : colors.surfaceMuted,
            }}
          >
            <Icon name={icon} size={17} color={color} />
          </View>
        ) : null)}
      <View style={{ flex: 1, gap: 1 }}>
        <AppText variant="bodyStrong" tone={destructive ? 'danger' : 'text'} numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="small" tone="textMuted" numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
      {chevron ? <Icon name="chevron-right" size={18} color={colors.textSubtle} /> : null}
    </>
  );
  const base = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    minHeight: hitSize + 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  };

  if (!onPress) return <View style={base}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      accessibilityHint={accessibilityHint}
      style={(s) => {
        const { pressed, hovered } = interaction(s);
        return [base, { backgroundColor: pressed ? colors.surfacePressed : hovered ? colors.surfaceMuted : 'transparent' }];
      }}
    >
      {content}
    </Pressable>
  );
}
