import type { EntityRef } from '@/types/entity';
import type { RelatedContext } from '@/types/module';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Sheet } from '@/components/ui/Sheet';
import { Divider } from '@/components/ui/Divider';
import { interaction } from '@/components/ui/interaction';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useLocale } from '@/hooks/useLocale';
import { useToday } from '@/hooks/useToday';
import { StatTile } from '@/modules/dashboard/components/StatTile';
import { SummaryTile } from '@/modules/dashboard/components/SummaryTile';
import { addDays, formatLongDate, formatTime, fromDateKey, toDateKey } from '@/utils/date';
import { EventRow } from './components/EventRow';
import { EventFormSheet } from './components/EventFormSheet';
import { NoteCard } from './components/DayAgenda';
import { useCalendars, useDayNotes, useOccurrences } from './hooks';
import type { EventOccurrence } from './types';
import { calendarsMeta } from './meta';

function useTodayOccurrences() {
  const today = useToday();
  return useOccurrences(fromDateKey(today), 1);
}

export function AgendaTodayWidget() {
  const { t } = useTranslation();
  const today = useToday();
  const { data, isLoading, isError, refetch } = useTodayOccurrences();
  const notes = useDayNotes(fromDateKey(today), 1).data ?? [];
  const openDay = () => router.navigate({ pathname: '/calendars', params: { day: today } });
  return (
    <Card style={{ flex: 1 }}>
      <CardHeader
        title={t('calendars.widget.title')}
        icon="calendar"
        accent={calendarsMeta.accent}
        actionLabel={t('calendars.widget.open')}
        onAction={() => router.navigate('/calendars')}
      />
      {isLoading ? <LoadingState /> : isError ? <ErrorState onRetry={() => void refetch()} /> : null}
      {notes.length ? (
        <View style={{ gap: 6, marginBottom: 8 }}>
          {notes.map((n) => (
            <NoteCard key={n.id} note={n} onPress={openDay} />
          ))}
        </View>
      ) : null}
      {isLoading || isError ? null : !data?.length ? (
        <EmptyState
          compact
          icon="sun"
          accent={calendarsMeta.accent}
          title={t('calendars.noEventsToday')}
          actionLabel={t('calendars.newEvent')}
          onAction={() => router.navigate('/calendars')}
        />
      ) : (
        data.slice(0, 6).map((o, i) => (
          <Pressable
            key={o.key}
            onPress={() => router.navigate({ pathname: '/calendars', params: { event: o.event.id } })}
            accessibilityRole="button"
            style={(s) => ({ opacity: interaction(s).pressed ? 0.6 : 1 })}
          >
            {i > 0 ? <Divider /> : null}
            <EventRow occurrence={o} />
          </Pressable>
        ))
      )}
    </Card>
  );
}

export function CalendarsTodaySummary() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { data, isLoading } = useTodayOccurrences();
  const count = data?.length ?? 0;
  return (
    <SummaryTile
      icon="calendar"
      accent={calendarsMeta.accent}
      label={t('modules.calendars.title')}
      loading={isLoading}
      value={count === 0 ? t('calendars.summary.none') : t('calendars.summary.events', { count })}
      details={(data ?? [])
        .slice(0, 3)
        .map((o) => `${o.event.allDay ? t('calendars.allDay') : formatTime(o.start, locale)}  ${o.event.title}`)}
      onPress={() => router.navigate('/calendars')}
    />
  );
}

/** "Próximos 7 días": what is coming after today, grouped by day. */
export function UpcomingWidget() {
  const { t } = useTranslation();
  const locale = useLocale();
  const today = useToday();
  const { data, isLoading } = useOccurrences(addDays(fromDateKey(today), 1), 7);
  const groups = useMemo(() => {
    const map = new Map<string, EventOccurrence[]>();
    for (const o of data ?? []) {
      const key = toDateKey(o.start);
      map.set(key, [...(map.get(key) ?? []), o]);
    }
    return [...map.entries()].slice(0, 4);
  }, [data]);
  const tomorrow = toDateKey(addDays(fromDateKey(today), 1));

  return (
    <Card style={{ flex: 1 }}>
      <CardHeader
        title={t('calendars.upcoming.title')}
        icon="calendar"
        accent={calendarsMeta.accent}
        actionLabel={t('calendars.widget.open')}
        onAction={() => router.navigate('/calendars')}
      />
      {isLoading ? (
        <LoadingState />
      ) : groups.length === 0 ? (
        <EmptyState compact icon="calendar" accent={calendarsMeta.accent} title={t('calendars.upcoming.empty')} />
      ) : (
        groups.map(([key, items]) => (
          <View key={key} style={{ marginBottom: 8 }}>
            <AppText variant="overline" tone="textMuted">
              {key === tomorrow ? t('common.tomorrow') : formatLongDate(fromDateKey(key), locale)}
            </AppText>
            {items.slice(0, 3).map((o) => (
              <EventRow key={o.key} occurrence={o} />
            ))}
          </View>
        ))
      )}
    </Card>
  );
}

export function CalendarsWeeklyStats() {
  const { t } = useTranslation();
  const today = useToday();
  const { data, isLoading } = useOccurrences(fromDateKey(today), 7);
  return (
    <StatTile
      icon="calendar"
      accent={calendarsMeta.accent}
      value={data?.length ?? 0}
      label={t('calendars.stats.nextWeek')}
      loading={isLoading}
    />
  );
}

/** Quick action: create an event from Inicio (or explain how to start). */
function QuickEventForm({ onClose, link, context }: { onClose: () => void; link?: EntityRef; context?: RelatedContext }) {
  const { t } = useTranslation();
  const today = useToday();
  const { data, isLoading } = useCalendars();
  const calendars = useMemo(() => (data ?? []).filter((c) => c.isActive), [data]);
  if (isLoading) return null;
  if (!calendars.length) {
    return (
      <Sheet visible onClose={onClose} title={t('calendars.newEvent')}>
        <EmptyState
          compact
          icon="calendar"
          accent={calendarsMeta.accent}
          title={t('calendars.empty.title')}
          description={t('calendars.empty.description')}
          secondary={
            <Button
              label={t('calendars.newCalendar')}
              icon="layers"
              onPress={() => {
                onClose();
                router.navigate('/calendars');
              }}
              style={{ alignSelf: 'center', marginTop: 8 }}
            />
          }
        />
      </Sheet>
    );
  }
  return (
    <EventFormSheet
      visible
      onClose={onClose}
      date={today}
      calendars={calendars}
      initialLinks={link ? [link] : undefined}
      initialCalendarId={context?.calendarId}
    />
  );
}

export function QuickEventSheet({
  visible,
  onClose,
  link,
  context,
}: {
  visible: boolean;
  onClose: () => void;
  link?: EntityRef;
  context?: RelatedContext;
}) {
  return visible ? <QuickEventForm onClose={onClose} link={link} context={context} /> : null;
}
