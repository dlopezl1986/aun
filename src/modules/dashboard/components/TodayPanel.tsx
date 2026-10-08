import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { useLocale } from '@/hooks/useLocale';
import { useEnabledModules } from '@/state/userSettingsStore';
import { useTheme } from '@/theme';
import { formatLongDate } from '@/utils/date';

/**
 * "HOY" — the heart of the command centre (section 8). Each enabled module
 * contributes its own summary tile; disabled modules contribute nothing.
 */
export function TodayPanel() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { spacing } = useTheme();
  const modules = useEnabledModules();
  const contributors = modules.filter((m) => m.todaySummary).sort((a, b) => a.nav.order - b.nav.order);

  return (
    <Card style={{ gap: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <TodayBadge label={t('dashboard.today')} />
        <AppText variant="bodyStrong" tone="textMuted">
          {formatLongDate(new Date(), locale)}
        </AppText>
      </View>
      {contributors.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          {contributors.map((m) => {
            const Summary = m.todaySummary!;
            return <Summary key={m.id} />;
          })}
        </View>
      ) : (
        <AppText variant="body" tone="textMuted">
          {t('dashboard.noModules')}
        </AppText>
      )}
    </Card>
  );
}

/** Own component so it reads the card's palette (inside Card's SurfaceScope), not the canvas one. */
function TodayBadge({ label }: { label: string }) {
  const { spacing, colors, radius } = useTheme();
  return (
    <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.sm, backgroundColor: colors.primary }}>
      <AppText variant="overline" color={colors.onPrimary} style={{ letterSpacing: 2 }}>
        {label}
      </AppText>
    </View>
  );
}
