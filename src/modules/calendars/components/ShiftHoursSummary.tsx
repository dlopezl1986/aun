import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { useLocale } from '@/hooks/useLocale';
import { useTheme } from '@/theme';
import { formatMonthYear } from '@/utils/date';
import { formatHours, type ShiftCalendarTotal } from '../shiftHours';

/** Under the month: the hours of the shifts of that month, per shift label (and per calendar if several). */
export function ShiftHoursSummary({ totals, month }: { totals: ShiftCalendarTotal[]; month: Date }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { spacing, colors, radius } = useTheme();
  if (!totals.length) return null;
  const all = totals.reduce((n, c) => n + c.hours, 0);
  const several = totals.length > 1;
  return (
    <View style={{ gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceMuted }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name="clock" size={16} color={colors.primary} />
        <AppText variant="bodyStrong" style={{ flex: 1 }} accessibilityRole="header">
          {t('calendars.shiftHours.title', { month: formatMonthYear(month, locale) })}
        </AppText>
        {several ? null : (
          <AppText variant="bodyStrong" color={colors.primary}>
            {formatHours(all, locale)}
          </AppText>
        )}
      </View>
      {totals.map((c) => (
        <View key={c.calendarId} style={{ gap: 4 }}>
          {several ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.calendarColor }} />
              <AppText variant="smallStrong" style={{ flex: 1 }}>
                {c.calendarName}
              </AppText>
              <AppText variant="smallStrong" color={colors.primary}>
                {formatHours(c.hours, locale)}
              </AppText>
            </View>
          ) : null}
          {c.byType.map((r) => (
            <View
              key={r.key}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: several ? spacing.md : 0 }}
            >
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: r.color }} />
              <AppText variant="small" style={{ flex: 1 }}>
                {r.name}
                <AppText variant="small" tone="textMuted">
                  {`  ${t('calendars.shiftHours.count', { count: r.count })}`}
                </AppText>
              </AppText>
              <AppText variant="small" tone={r.hours ? 'text' : 'textMuted'}>
                {formatHours(r.hours, locale)}
              </AppText>
            </View>
          ))}
          <AppText variant="caption" tone="textMuted" style={{ paddingLeft: several ? spacing.md : 0 }}>
            {t('calendars.shiftHours.total', { count: c.count, hours: formatHours(c.hours, locale) })}
          </AppText>
        </View>
      ))}
      {several ? (
        <AppText variant="smallStrong" style={{ textAlign: 'right' }}>
          {t('calendars.shiftHours.all', { hours: formatHours(all, locale) })}
        </AppText>
      ) : null}
    </View>
  );
}
