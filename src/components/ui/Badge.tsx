import { View } from 'react-native';

import { SurfaceScope, useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  /** Custom colour (overrides tone), e.g. a calendar colour. */
  color?: string;
  icon?: IconName;
}

function BadgeBase({ label, tone = 'neutral', color, icon }: BadgeProps) {
  const { colors, radius, spacing } = useTheme();
  const map = {
    neutral: { bg: colors.surfaceMuted, fg: colors.textMuted },
    primary: { bg: colors.primarySoft, fg: colors.primary },
    success: { bg: colors.successSoft, fg: colors.success },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    info: { bg: colors.infoSoft, fg: colors.info },
  }[tone];
  const fg = color ?? map.fg;
  const bg = color ? withAlpha(color, 0.14) : map.bg;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        alignSelf: 'flex-start',
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: radius.pill,
        backgroundColor: bg,
      }}
    >
      {icon ? <Icon name={icon} size={12} color={fg} /> : null}
      <AppText variant="caption" color={fg} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

/** Has its own background: always drawn with the normal (non-canvas) palette. */
export function Badge(props: BadgeProps) {
  return (
    <SurfaceScope>
      <BadgeBase {...props} />
    </SurfaceScope>
  );
}
