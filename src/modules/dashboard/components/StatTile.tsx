import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';

interface StatTileProps {
  icon: IconName;
  accent: string;
  value: number | string;
  label: string;
  loading?: boolean;
}

/** Compact KPI used by the "Tu semana" widget. Modules render one or more. */
export function StatTile({ icon, accent, value, label, loading }: StatTileProps) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={loading ? label : `${value} ${label}`}
      style={{
        flexGrow: 1,
        flexBasis: 130,
        gap: spacing.xs,
        padding: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: withAlpha(accent, 0.07),
      }}
    >
      <Icon name={icon} size={16} color={accent} />
      {loading ? (
        <View style={{ height: 30, width: 40, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted }} />
      ) : (
        <AppText variant="display" style={{ fontSize: 26, lineHeight: 32 }}>
          {value}
        </AppText>
      )}
      <AppText variant="small" tone="textMuted" numberOfLines={2}>
        {label}
      </AppText>
    </View>
  );
}
