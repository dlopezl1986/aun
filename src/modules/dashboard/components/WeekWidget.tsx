import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Card, CardHeader } from '@/components/ui/Card';
import { useEnabledModules } from '@/state/userSettingsStore';
import { useTheme } from '@/theme';

/** "Tu semana": KPIs contributed by every enabled module (AppModule.weeklyStats). */
export function WeekWidget() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const contributors = useEnabledModules()
    .filter((m) => m.weeklyStats)
    .sort((a, b) => a.nav.order - b.nav.order);

  return (
    <Card style={{ flex: 1 }}>
      <CardHeader title={t('dashboard.week.title')} subtitle={t('dashboard.week.subtitle')} icon="bar-chart-2" />
      {contributors.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {contributors.map((m) => {
            const Stats = m.weeklyStats!;
            return <Stats key={m.id} />;
          })}
        </View>
      ) : (
        <AppText variant="small" tone="textMuted">
          {t('dashboard.noModules')}
        </AppText>
      )}
    </Card>
  );
}
