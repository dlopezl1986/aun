import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Card, CardHeader } from '@/components/ui/Card';
import { interaction } from '@/components/ui/interaction';
import { useToday } from '@/hooks/useToday';
import { useCalendarPrefs } from '@/state/userSettingsStore';
import { useTheme } from '@/theme';
import { fromDateKey, monthMatrix, toDateKey } from '@/utils/date';
import { holidayOccurrences, holidaysBetween, isHoliday } from '../holidays';
import { useCalendars, useDayNotes, useOccurrences } from '../hooks';
import { calendarsMeta } from '../meta';
import { MonthGrid } from './MonthGrid';

/**
 * Inicio: the month with every visible calendar at once (same grid as
 * Calendarios). Tapping a day, an event or a calendar opens Calendarios there.
 */
export function CalendarsOverviewWidget() {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const today = useToday();
  const [month, setMonth] = useState(() => fromDateKey(today));
  const start = useMemo(() => monthMatrix(month)[0][0], [month]);
  const occurrences = useOccurrences(start, 42);
  const notes = useDayNotes(start, 42).data ?? [];
  const prefs = useCalendarPrefs();
  const holidays = useMemo(() => (prefs.holidays ? holidaysBetween(start, 42) : new Map<string, string>()), [prefs.holidays, start]);
  const occ = [...holidayOccurrences(holidays, t('calendars.holidays.title')), ...(occurrences.data ?? [])];
  const calendars = (useCalendars().data ?? []).filter((c) => c.isActive);

  const openDay = (day: string) => router.navigate({ pathname: '/calendars', params: { day } });

  return (
    <Card style={{ flex: 1 }}>
      <CardHeader
        title={t('calendars.overview.title')}
        icon="calendar"
        accent={calendarsMeta.accent}
        actionLabel={t('calendars.widget.open')}
        onAction={() => router.navigate('/calendars')}
      />
      {calendars.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs, marginBottom: spacing.md }}>
          {calendars.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => router.navigate('/calendars')}
              accessibilityRole="link"
              accessibilityLabel={c.name}
              style={(s) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: spacing.md,
                height: 30,
                borderRadius: radius.pill,
                backgroundColor: interaction(s).hovered ? colors.surfacePressed : colors.surfaceMuted,
              })}
            >
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.color }} />
              <AppText variant="smallStrong" numberOfLines={1}>
                {c.name}
              </AppText>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <MonthGrid
        month={month}
        selected={today}
        today={today}
        occurrences={occ}
        notes={notes}
        onSelect={openDay}
        onMonthChange={setMonth}
        onEventPress={(o) =>
          isHoliday(o) ? openDay(toDateKey(o.start)) : router.navigate({ pathname: '/calendars', params: { event: o.event.id } })
        }
        onNotePress={(n) => openDay(n.date)}
        onDayOpen={openDay}
        holidays={holidays}
      />
    </Card>
  );
}
