import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ChipGroup } from '@/components/forms/Chips';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { useLocale } from '@/hooks/useLocale';
import { useEnabledModules, useUserSettings } from '@/state/userSettingsStore';
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
  const all = modules.filter((m) => m.todaySummary).sort((a, b) => a.nav.order - b.nav.order);
  // What to show inside "Hoy" is chosen while customising Inicio.
  const hiddenIds = useUserSettings((s) => s.settings?.dashboard.todayHidden);
  const hidden = new Set(hiddenIds ?? []);
  const contributors = all.filter((m) => !hidden.has(m.id));

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
          {all.length ? t('dashboard.todayEmpty') : t('dashboard.noModules')}
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

/**
 * "Qué mostrar en Hoy", shown in the edit toolbar while customising Inicio
 * (the panel itself is only a preview there and cannot be tapped).
 */
export function TodayEditControls() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const modules = useEnabledModules();
  const all = modules.filter((m) => m.todaySummary).sort((a, b) => a.nav.order - b.nav.order);
  const hiddenIds = useUserSettings((s) => s.settings?.dashboard.todayHidden);
  const setVisible = useUserSettings((s) => s.setTodayItemVisible);
  const hidden = new Set(hiddenIds ?? []);
  if (!all.length) return null;
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="smallStrong">{t('dashboard.todayPick')}</AppText>
      <AppText variant="caption" tone="textMuted">
        {t('dashboard.todayPickHint')}
      </AppText>
      <ChipGroup<string>
        multi
        accessibilityLabel={t('dashboard.todayPick')}
        selected={all.filter((m) => !hidden.has(m.id)).map((m) => m.id)}
        onToggle={(id) => void setVisible(id, hidden.has(id))}
        options={all.map((m) => ({ value: m.id, label: t(m.titleKey) }))}
      />
    </View>
  );
}
