import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Icon, type IconName } from '@/components/ui/Icon';
import { interaction } from '@/components/ui/interaction';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useTheme } from '@/theme';
import { lighten, withAlpha } from '@/utils/color';

interface SummaryTileProps {
  icon: IconName;
  accent: string;
  label: string;
  value: string;
  details?: string[];
  onPress?: () => void;
  loading?: boolean;
  /** Something needs attention (overdue, due now…): highlighted in red. */
  alert?: boolean;
  alertLabel?: string;
}

/** One module's line in the "HOY" panel. */
export function SummaryTile({ icon, accent, label, value, details, onPress, loading, alert, alertLabel }: SummaryTileProps) {
  const { colors, spacing, radius, mode } = useTheme();
  const { isCompact } = useBreakpoint();
  const pad = isCompact ? spacing.md : spacing.lg;
  const ink = mode === 'dark' ? lighten(accent, 0.35) : accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'summary'}
      accessibilityLabel={loading ? label : `${label}: ${value}${details?.length ? `. ${details.join(', ')}` : ''}`}
      style={(s) => {
        const { hovered, pressed } = interaction(s);
        return {
          flexGrow: 1,
          flexBasis: 140,
          gap: spacing.sm,
          padding: pad,
          paddingTop: pad + 4,
          borderRadius: radius.lg,
          borderWidth: 1,
          overflow: 'hidden',
          borderColor: alert ? withAlpha(colors.danger, 0.6) : hovered ? withAlpha(accent, 0.55) : colors.border,
          // A light wash of the module colour makes each tile recognisable at a glance.
          backgroundColor: pressed ? withAlpha(accent, 0.22) : withAlpha(accent, hovered ? 0.17 : 0.12),
        };
      }}
    >
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: alert ? colors.danger : accent }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: radius.sm + 2,
            backgroundColor: withAlpha(accent, 0.16),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon} size={16} color={ink} />
        </View>
        <AppText variant="overline" color={ink} style={{ flex: 1 }} numberOfLines={1}>
          {label}
        </AppText>
        {alert && !loading ? (
          <View
            accessibilityLabel={alertLabel}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: radius.pill,
              backgroundColor: colors.dangerSoft,
            }}
          >
            <Icon name="alert-circle" size={11} color={colors.danger} />
            {alertLabel ? (
              <AppText variant="caption" tone="danger" style={{ fontSize: 10, lineHeight: 12 }}>
                {alertLabel}
              </AppText>
            ) : null}
          </View>
        ) : null}
      </View>
      {loading ? (
        // Neutral placeholder: never show "no events" before data is known.
        <View style={{ height: 22, width: '60%', borderRadius: radius.sm, backgroundColor: colors.surfaceMuted, marginVertical: 1 }} />
      ) : (
        <AppText variant="heading" numberOfLines={1}>
          {value}
        </AppText>
      )}
      {(loading ? [] : (details ?? [])).slice(0, 3).map((d, i) => (
        <AppText key={`${i}-${d}`} variant="small" tone="textMuted" numberOfLines={1}>
          {d}
        </AppText>
      ))}
    </Pressable>
  );
}
