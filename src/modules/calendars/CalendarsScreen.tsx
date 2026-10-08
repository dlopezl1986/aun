import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Divider } from '@/components/ui/Divider';
import { IconButton } from '@/components/ui/IconButton';
import { InfoNote } from '@/components/ui/InfoNote';
import { interaction } from '@/components/ui/interaction';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useLocale } from '@/hooks/useLocale';
import { useToday } from '@/hooks/useToday';
import { accentPalette, useTheme } from '@/theme';
import { addDays, addMonths, formatLongDate, formatMonthYear, formatShortDate, fromDateKey, monthMatrix, toDateKey } from '@/utils/date';
import { mondayIndex } from '@/utils/recurrence';
import { CalendarFormSheet } from './components/CalendarFormSheet';
import { CalendarList } from './components/CalendarList';
import { EventDetailSheet } from './components/EventDetailSheet';
import { EventFormSheet } from './components/EventFormSheet';
import { DayAgenda, EventCard, NoteCard } from './components/DayAgenda';
import { DayNoteSheet } from './components/DayNoteSheet';
import { MonthGrid } from './components/MonthGrid';
import { TimeGrid } from './components/TimeGrid';
import { useCalendars, useCreateCalendar, useDayNotes, useEvent, useOccurrences } from './hooks';
import { calendarsMeta } from './meta';
import type { Calendar, CalendarEvent, DayNote, EventOccurrence } from './types';

type ViewMode = 'day' | 'week' | 'month' | 'agenda';
type DayLayout = 'list' | 'hours';

interface DayGroup {
  events: EventOccurrence[];
  notes: DayNote[];
}

/** Events and notes by day, in date order (days with only notes included). */
function groupByDay(items: EventOccurrence[], notes: DayNote[]): [string, DayGroup][] {
  const map = new Map<string, DayGroup>();
  const at = (key: string) => map.get(key) ?? map.set(key, { events: [], notes: [] }).get(key)!;
  for (const o of items) at(toDateKey(o.start)).events.push(o);
  for (const n of notes) at(n.date).notes.push(n);
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

/** Range [start, days) loaded for each view. */
function rangeFor(mode: ViewMode, anchor: Date): { start: Date; days: number } {
  if (mode === 'day') return { start: anchor, days: 1 };
  if (mode === 'week') return { start: addDays(anchor, -mondayIndex(anchor)), days: 7 };
  if (mode === 'month') return { start: monthMatrix(anchor)[0][0], days: 42 };
  return { start: anchor, days: 30 };
}

export function CalendarsScreen() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { spacing } = useTheme();
  const { breakpoint, isCompact } = useBreakpoint();
  const { height: windowHeight } = useWindowDimensions();
  const today = useToday();
  const params = useLocalSearchParams<{ event?: string; day?: string }>();

  const [mode, setMode] = useState<ViewMode>(isCompact ? 'agenda' : 'week');
  const [selected, setSelected] = useState(today);
  const [calendarSheet, setCalendarSheet] = useState<{ open: boolean; calendar: Calendar | null }>({ open: false, calendar: null });
  const [eventForm, setEventForm] = useState<{ open: boolean; event: CalendarEvent | null; date: string; time: string | null }>({
    open: false,
    event: null,
    date: today,
    time: null,
  });
  const [detail, setDetail] = useState<EventOccurrence | null>(null);
  const [noteSheet, setNoteSheet] = useState<{ date: string; note: DayNote | null } | null>(null);
  const [dayLayout, setDayLayout] = useState<DayLayout>('list');

  const calendarsQuery = useCalendars();
  const allCalendars = useMemo(() => calendarsQuery.data ?? [], [calendarsQuery.data]);
  const activeCalendars = useMemo(() => allCalendars.filter((c) => c.isActive), [allCalendars]);
  const anchor = fromDateKey(selected);
  const range = rangeFor(mode, anchor);
  const occurrences = useOccurrences(range.start, range.days);
  const notesQuery = useDayNotes(range.start, range.days);
  const createCalendar = useCreateCalendar();

  // Deep link from the global search: /calendars?event=<id>
  const linked = useEvent(typeof params.event === 'string' ? params.event : null);
  const [handledLink, setHandledLink] = useState<string | null>(null);
  if (linked.data && handledLink !== linked.data.id) {
    const calendar = allCalendars.find((c) => c.id === linked.data!.calendarId);
    if (calendar) {
      setHandledLink(linked.data.id);
      const start = new Date(linked.data.start);
      setSelected(toDateKey(start));
      setDetail({ key: `${linked.data.id}:${toDateKey(start)}`, event: linked.data, calendar, start, end: new Date(linked.data.end) });
    }
  }

  // Deep link from a note (search / notification): /calendars?day=YYYY-MM-DD
  const [handledDay, setHandledDay] = useState<string | null>(null);
  if (typeof params.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.day) && handledDay !== params.day) {
    setHandledDay(params.day);
    setSelected(params.day);
    setMode('day');
    setDayLayout('list');
  }

  const openNote = (date: string, note: DayNote | null = null) => setNoteSheet({ date, note });
  const newEvent = (date = selected, time: string | null = null) => setEventForm({ open: true, event: null, date, time });
  const editEvent = (event: CalendarEvent) => {
    setDetail(null);
    setEventForm({ open: true, event, date: toDateKey(new Date(event.start)), time: null });
  };
  const shift = (dir: -1 | 1) => {
    const next =
      mode === 'day'
        ? addDays(anchor, dir)
        : mode === 'week'
          ? addDays(anchor, 7 * dir)
          : mode === 'month'
            ? addMonths(anchor, dir)
            : addDays(anchor, 30 * dir);
    setSelected(toDateKey(next));
  };

  const header = (
    <PageHeader
      title={t('modules.calendars.title')}
      subtitle={t('calendars.subtitle')}
      icon={calendarsMeta.icon}
      accent={calendarsMeta.accent}
      actions={
        activeCalendars.length ? (
          <>
            <Button label={t('calendars.notes.new')} icon="bookmark" variant="secondary" onPress={() => openNote(selected)} />
            <Button label={t('calendars.newEvent')} icon="plus" onPress={() => newEvent()} />
          </>
        ) : null
      }
    />
  );

  const sheets = (
    <>
      <CalendarFormSheet
        visible={calendarSheet.open}
        calendar={calendarSheet.calendar}
        onClose={() => setCalendarSheet({ open: false, calendar: null })}
      />
      <EventFormSheet
        visible={eventForm.open}
        onClose={() => setEventForm((s) => ({ ...s, open: false }))}
        calendars={activeCalendars}
        event={eventForm.event}
        date={eventForm.date}
        time={eventForm.time}
      />
      <EventDetailSheet occurrence={detail} onClose={() => setDetail(null)} onEdit={editEvent} />
      <DayNoteSheet target={noteSheet} onClose={() => setNoteSheet(null)} />
    </>
  );

  if (calendarsQuery.isLoading) {
    return (
      <Screen>
        {header}
        <LoadingState />
      </Screen>
    );
  }
  if (calendarsQuery.isError) {
    return (
      <Screen>
        {header}
        <ErrorState onRetry={() => void calendarsQuery.refetch()} />
      </Screen>
    );
  }

  if (!activeCalendars.length) {
    const suggestions = [t('calendars.suggestions.personal'), t('calendars.suggestions.family'), t('calendars.suggestions.work')];
    return (
      <Screen>
        {header}
        <Card>
          <EmptyState
            icon="calendar"
            accent={calendarsMeta.accent}
            title={t('calendars.empty.title')}
            description={t('calendars.empty.description')}
            actionLabel={t('calendars.newCalendar')}
            onAction={() => setCalendarSheet({ open: true, calendar: null })}
            secondary={
              <View style={{ alignItems: 'center', gap: spacing.sm, marginTop: spacing.md }}>
                <AppText variant="small" tone="textMuted">
                  {t('calendars.empty.quickStart')}
                </AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm }}>
                  {suggestions.map((name, i) => (
                    <Button
                      key={name}
                      label={name}
                      size="sm"
                      variant="secondary"
                      onPress={() => createCalendar.mutate({ name, color: accentPalette[(i * 3 + 1) % accentPalette.length] })}
                    />
                  ))}
                </View>
              </View>
            }
          />
        </Card>
        {allCalendars.length ? (
          <CalendarList
            calendars={allCalendars}
            onCreate={() => setCalendarSheet({ open: true, calendar: null })}
            onEdit={(c) => setCalendarSheet({ open: true, calendar: c })}
          />
        ) : null}
        {sheets}
      </Screen>
    );
  }

  const occ = occurrences.data ?? [];
  const notes = notesQuery.data ?? [];
  const onNote = (n: DayNote) => openNote(n.date, n);
  const weekStart = addDays(anchor, -mondayIndex(anchor));
  const rangeLabel =
    mode === 'day'
      ? selected === today
        ? `${t('common.today')} · ${formatLongDate(anchor, locale)}`
        : formatLongDate(anchor, locale)
      : mode === 'week'
        ? `${formatShortDate(weekStart, locale)} – ${formatShortDate(addDays(weekStart, 6), locale)}`
        : mode === 'month'
          ? formatMonthYear(anchor, locale)
          : t('calendars.agendaFrom', { date: formatShortDate(anchor, locale) });

  const navBar =
    mode === 'month' ? null : (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm }}>
        <AppText variant="heading" style={{ flex: 1 }} numberOfLines={1} accessibilityRole="header">
          {rangeLabel}
        </AppText>
        <IconButton icon="chevron-left" label={t('calendars.previous')} onPress={() => shift(-1)} />
        <Button label={t('common.today')} size="sm" variant="ghost" onPress={() => setSelected(today)} />
        <IconButton icon="chevron-right" label={t('calendars.next')} onPress={() => shift(1)} />
      </View>
    );

  const timelineHeight = Math.max(360, Math.min(720, windowHeight - 330));
  const dayList = (key: string, group: DayGroup) => (
    <View key={key} style={{ marginBottom: spacing.md, gap: spacing.xs }}>
      <Pressable
        onPress={() => {
          setSelected(key);
          setMode('day');
          setDayLayout('list');
        }}
        accessibilityRole="button"
        style={(s) => ({ opacity: interaction(s).pressed ? 0.6 : 1 })}
      >
        <AppText variant="overline" tone={key === today ? 'primary' : 'textMuted'}>
          {key === today
            ? t('common.today')
            : key === toDateKey(addDays(fromDateKey(today), 1))
              ? t('common.tomorrow')
              : formatLongDate(fromDateKey(key), locale)}
        </AppText>
      </Pressable>
      {group.notes.map((n) => (
        <NoteCard key={n.id} note={n} onPress={onNote} />
      ))}
      {group.events.map((o) => (
        <EventCard key={o.key} occurrence={o} onPress={setDetail} />
      ))}
    </View>
  );

  let body: React.ReactNode;
  if (occurrences.isLoading) body = <LoadingState />;
  else if (mode === 'day' && dayLayout === 'list') {
    body = (
      <DayAgenda
        occurrences={occ}
        notes={notes}
        onEvent={setDetail}
        onNote={(n) => openNote(selected, n)}
        onNewEvent={() => newEvent(selected)}
      />
    );
  } else if (mode === 'day' || (mode === 'week' && !isCompact)) {
    const days = mode === 'day' ? [anchor] : Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    body = (
      <TimeGrid
        days={days}
        occurrences={occ}
        notes={notes}
        today={today}
        height={timelineHeight}
        onSlotPress={(date, time) => newEvent(date, time)}
        onEventPress={setDetail}
        onNotePress={onNote}
      />
    );
  } else if (mode === 'week') {
    // Phones: the week as a compact day-by-day list instead of 7 tiny columns.
    const groups = new Map(groupByDay(occ, notes));
    body = Array.from({ length: 7 }, (_, i) => toDateKey(addDays(weekStart, i))).map((key) =>
      groups.get(key) ? (
        dayList(key, groups.get(key)!)
      ) : (
        <View key={key} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
          <AppText variant="overline" tone={key === today ? 'primary' : 'textSubtle'} style={{ flex: 1 }}>
            {formatLongDate(fromDateKey(key), locale)}
          </AppText>
          <AppText variant="caption" tone="textSubtle">
            {t('calendars.free')}
          </AppText>
        </View>
      ),
    );
  } else if (mode === 'month') {
    body = (
      <View style={{ gap: spacing.md }}>
        <MonthGrid
          month={anchor}
          selected={selected}
          today={today}
          occurrences={occ}
          notes={notes}
          onSelect={setSelected}
          onMonthChange={(m) => setSelected(toDateKey(m))}
          onEventPress={setDetail}
          onNotePress={onNote}
        />
        <Divider />
        <CardHeader
          title={selected === today ? t('common.today') : formatLongDate(anchor, locale)}
          icon="clock"
          accent={calendarsMeta.accent}
        />
        <DayAgenda
          occurrences={occ.filter((o) => toDateKey(o.start) === selected)}
          notes={notes.filter((n) => n.date === selected)}
          onEvent={setDetail}
          onNote={(n) => openNote(selected, n)}
          onNewEvent={() => newEvent(selected)}
        />
      </View>
    );
  } else {
    body =
      occ.length || notes.length ? (
        groupByDay(occ, notes).map(([key, group]) => dayList(key, group))
      ) : (
        <EmptyState
          compact
          icon="calendar"
          accent={calendarsMeta.accent}
          title={t('calendars.noEventsAgenda')}
          actionLabel={t('calendars.newEvent')}
          onAction={() => newEvent()}
        />
      );
  }

  const mainColumn = (
    <View style={{ gap: spacing.md, flex: 1 }}>
      <SegmentedControl<ViewMode>
        accessibilityLabel={t('calendars.viewLabel')}
        value={mode}
        onChange={setMode}
        options={[
          { value: 'day', label: t('calendars.views.day'), icon: 'square' },
          { value: 'week', label: t('calendars.views.week'), icon: 'columns' },
          { value: 'month', label: t('calendars.views.month'), icon: 'grid' },
          { value: 'agenda', label: t('calendars.views.agenda'), icon: 'list' },
        ]}
      />
      <Card>
        {navBar}
        {mode === 'day' ? (
          <View style={{ marginBottom: spacing.md }}>
            <SegmentedControl<DayLayout>
              accessibilityLabel={t('calendars.dayLayout.label')}
              value={dayLayout}
              onChange={setDayLayout}
              options={[
                { value: 'list', label: t('calendars.dayLayout.list'), icon: 'list' },
                { value: 'hours', label: t('calendars.dayLayout.hours'), icon: 'clock' },
              ]}
            />
          </View>
        ) : null}
        {body}
      </Card>
    </View>
  );

  const side = (
    <>
      <CalendarList
        calendars={allCalendars}
        onCreate={() => setCalendarSheet({ open: true, calendar: null })}
        onEdit={(c) => setCalendarSheet({ open: true, calendar: c })}
      />
      <InfoNote
        title={t('calendars.tips.title')}
        items={[t('calendars.tips.slot'), t('calendars.tips.recurring'), t('calendars.tips.links')]}
      />
    </>
  );

  const twoColumns = !isCompact && breakpoint !== 'medium';
  return (
    <Screen>
      {header}
      {twoColumns ? (
        <View style={{ flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' }}>
          {mainColumn}
          <View style={{ width: 300, gap: spacing.xl }}>{side}</View>
        </View>
      ) : (
        <>
          {mainColumn}
          {side}
        </>
      )}
      {sheets}
    </Screen>
  );
}

/** Opens a calendar event from anywhere (search results, links…). */
export const openCalendarEvent = (id: string) => router.navigate({ pathname: '/calendars', params: { event: id } });
