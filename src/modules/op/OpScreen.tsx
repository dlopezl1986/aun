import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useToast } from '@/components/feedback/ToastProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { interaction } from '@/components/ui/interaction';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useLocale } from '@/hooks/useLocale';
import { useToday } from '@/hooks/useToday';
import { MonthGrid } from '@/modules/calendars/components/MonthGrid';
import { formatHours } from '@/modules/calendars/shiftHours';
import type { Calendar, EventOccurrence } from '@/modules/calendars/types';
import { useTheme } from '@/theme';
import { addDays, combine, formatLongDate, formatShortDate, fromDateKey, toDateKey } from '@/utils/date';
import { CarriedNotes, OpSessionSheet } from './components/OpSessionSheet';
import { OpPlanBar } from './components/OpPlanBar';
import { OpSyllabus } from './components/OpSyllabus';
import { shortTopics, topicLabel } from './components/topicLabel';
import { useCarriedNotes, useOpLook, useOpSessions, useOpTopics, usePlanDay } from './hooks';
import { opMeta } from './meta';
import { hoursPerTopic, opTotals } from './service';
import type { OpSession, OpTopic } from './types';

/** Study days drawn on the month like events: "T1, T2, T5 · 3 h". */
function sessionOccurrences(sessions: OpSession[], topics: OpTopic[], calendar: Calendar, hoursLabel: (h: number) => string) {
  return sessions.map((s): EventOccurrence => {
    const start = combine(s.date);
    const what = shortTopics(s.topicIds, topics) || 'OP';
    return {
      key: `op:${s.id}`,
      calendar,
      start,
      end: addDays(start, 1),
      event: {
        id: s.id,
        ownerId: s.ownerId,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        calendarId: calendar.id,
        title: s.hours ? `${what} · ${hoursLabel(s.hours)}` : what,
        start: start.toISOString(),
        end: addDays(start, 1).toISOString(),
        allDay: true,
        participants: [],
        reminders: [],
      },
    };
  });
}

function Stat({ label, value }: { label: string; value: string }) {
  const { spacing, colors, radius } = useTheme();
  return (
    <View
      style={{ flexGrow: 1, flexBasis: 110, gap: 2, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceMuted }}
    >
      <AppText variant="caption" tone="textMuted">
        {label}
      </AppText>
      <AppText variant="heading" color={opMeta.accent}>
        {value}
      </AppText>
    </View>
  );
}

function SessionRow({ session, topics, onPress }: { session: OpSession; topics: OpTopic[]; onPress: () => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { spacing, colors, radius } = useTheme();
  const what = shortTopics(session.topicIds, topics) || t('op.session.noTopicsShort');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${formatLongDate(fromDateKey(session.date), locale)}: ${what}`}
      style={(s) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.sm,
        borderRadius: radius.sm,
        backgroundColor: interaction(s).hovered || s.pressed ? colors.surfaceMuted : 'transparent',
      })}
    >
      <AppText variant="smallStrong" style={{ width: 92 }}>
        {formatShortDate(fromDateKey(session.date), locale)}
      </AppText>
      <AppText variant="small" style={{ flex: 1 }} numberOfLines={1}>
        {what}
      </AppText>
      {session.hours ? (
        <AppText variant="small" tone="textMuted">
          {formatHours(session.hours, locale)}
        </AppText>
      ) : null}
    </Pressable>
  );
}

/** The selected day under the month: what is planned, hours and notes, and a button to open it. */
function DayPanel({ date, session, topics, onOpen }: { date: string; session: OpSession | null; topics: OpTopic[]; onOpen: () => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { spacing } = useTheme();
  const planned = topics.filter((x) => session?.topicIds.includes(x.id));
  const lines = session
    ? [
        session.hours ? `${t('op.session.hours')}: ${formatHours(session.hours, locale)}` : null,
        session.behind.trim() ? `${t('op.session.behind')}: ${session.behind.trim()}` : null,
        session.tomorrow.trim() ? `${t('op.session.tomorrow')}: ${session.tomorrow.trim()}` : null,
        session.notes.trim() ? `${t('op.session.notes')}: ${session.notes.trim()}` : null,
      ].filter((x): x is string => !!x)
    : [];
  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="bodyStrong">{formatLongDate(fromDateKey(date), locale)}</AppText>
      {session ? (
        <>
          {planned.map((x) => (
            <AppText key={x.id} variant="small">
              {`${session.doneTopicIds.includes(x.id) ? '✓' : '•'} ${topicLabel(x, t)}`}
            </AppText>
          ))}
          {lines.map((l) => (
            <AppText key={l} variant="small" tone="textMuted" numberOfLines={3}>
              {l}
            </AppText>
          ))}
        </>
      ) : (
        <AppText variant="small" tone="textMuted">
          {t('op.day.empty')}
        </AppText>
      )}
      <View style={{ flexDirection: 'row' }}>
        <Button label={session ? t('op.day.open') : t('op.day.record')} icon={session ? 'edit-2' : 'plus'} size="sm" onPress={onOpen} />
      </View>
    </View>
  );
}

export function OpScreen() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { spacing } = useTheme();
  const { isCompact } = useBreakpoint();
  const toast = useToast();
  const today = useToday();
  const look = useOpLook();
  const topicsQuery = useOpTopics();
  const sessionsQuery = useOpSessions();
  const carried = useCarriedNotes(today);
  const planDay = usePlanDay();

  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(() => fromDateKey(today));
  const [planning, setPlanning] = useState(false);
  const [brush, setBrush] = useState<string[]>([]);
  const [openDay, setOpenDay] = useState<string | null>(null);

  const topics = useMemo(() => topicsQuery.data ?? [], [topicsQuery.data]);
  const sessions = useMemo(() => sessionsQuery.data ?? [], [sessionsQuery.data]);
  const byDate = useMemo(() => new Map(sessions.map((s) => [s.date, s])), [sessions]);
  const calendar = useMemo<Calendar>(
    () => ({
      id: 'op',
      ownerId: '',
      createdAt: '',
      updatedAt: '',
      name: look.name,
      color: look.color,
      isActive: true,
      isVisible: true,
      order: 0,
    }),
    [look.name, look.color],
  );
  const occurrences = useMemo(
    () => sessionOccurrences(sessions, topics, calendar, (h) => formatHours(h, locale)),
    [sessions, topics, calendar, locale],
  );
  const totals = opTotals(sessions, today);
  const perTopic = useMemo(() => hoursPerTopic(sessions), [sessions]);
  const studied = topics.filter((x) => x.studied).length;
  const upcoming = sessions.filter((s) => s.date >= today).slice(0, 6);

  const paint = (date: string) => {
    if (!brush.length) {
      toast.show(t('op.plan.hintPick'), 'info');
      return;
    }
    setSelected(date);
    planDay.mutate({ date, topicIds: brush });
  };
  const startPlanning = () => {
    setPlanning(true);
    if (!topics.length) toast.show(t('op.plan.noTopics'), 'info');
  };

  const header = (
    <PageHeader
      title={t('modules.op.title')}
      subtitle={t('op.subtitle')}
      icon={opMeta.icon}
      accent={opMeta.accent}
      actions={
        <>
          <Button
            label={t('op.plan.button')}
            icon="edit-3"
            variant={planning ? 'primary' : 'secondary'}
            onPress={() => (planning ? setPlanning(false) : startPlanning())}
          />
          <Button label={t('op.day.recordToday')} icon="plus" onPress={() => setOpenDay(today)} />
        </>
      }
    />
  );

  if (topicsQuery.isLoading || sessionsQuery.isLoading) {
    return (
      <Screen>
        {header}
        <LoadingState />
      </Screen>
    );
  }
  if (topicsQuery.isError || sessionsQuery.isError) {
    return (
      <Screen>
        {header}
        <ErrorState
          onRetry={() => {
            void topicsQuery.refetch();
            void sessionsQuery.refetch();
          }}
        />
      </Screen>
    );
  }

  const monthCard = (
    <Card>
      <View style={{ gap: spacing.md }}>
        {planning ? (
          <OpPlanBar
            topics={topics}
            selected={brush}
            onToggle={(id) => setBrush((b) => (b.includes(id) ? b.filter((x) => x !== id) : [...b, id]))}
            onDone={() => setPlanning(false)}
          />
        ) : null}
        <MonthGrid
          month={month}
          selected={selected}
          today={today}
          occurrences={occurrences}
          onSelect={setSelected}
          onMonthChange={(m) => {
            setMonth(m);
            setSelected(toDateKey(m));
          }}
          onEventPress={(o) => {
            const date = toDateKey(o.start);
            setSelected(date);
            setOpenDay(date);
          }}
          onDayOpen={(d) => {
            setSelected(d);
            setOpenDay(d);
          }}
          onPaint={planning ? paint : undefined}
        />
        {planning ? null : (
          <DayPanel date={selected} session={byDate.get(selected) ?? null} topics={topics} onOpen={() => setOpenDay(selected)} />
        )}
      </View>
    </Card>
  );

  const side = (
    <>
      <Card>
        <CardHeader title={t('op.stats.title')} icon="clock" accent={opMeta.accent} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Stat label={t('op.stats.today')} value={formatHours(totals.today, locale)} />
          <Stat label={t('op.stats.week')} value={formatHours(totals.week, locale)} />
          <Stat label={t('op.stats.month')} value={formatHours(totals.month, locale)} />
          <Stat label={t('op.stats.total')} value={formatHours(totals.total, locale)} />
        </View>
        {topics.length ? (
          <AppText variant="small" tone="textMuted" style={{ marginTop: spacing.sm }}>
            {t('op.stats.studied', { done: studied, total: topics.length })}
          </AppText>
        ) : null}
      </Card>
      {carried.data ? (
        <Card>
          <CardHeader title={t('op.carried.title')} icon="corner-down-right" accent={opMeta.accent} />
          <CarriedNotes session={carried.data} />
        </Card>
      ) : null}
      <Card>
        <CardHeader title={t('op.upcoming.title')} icon="calendar" accent={opMeta.accent} />
        {upcoming.length ? (
          upcoming.map((s) => <SessionRow key={s.id} session={s} topics={topics} onPress={() => setOpenDay(s.date)} />)
        ) : (
          <AppText variant="small" tone="textMuted">
            {t('op.upcoming.empty')}
          </AppText>
        )}
      </Card>
    </>
  );

  return (
    <Screen>
      {header}
      {isCompact ? (
        <View style={{ gap: spacing.lg }}>
          {monthCard}
          {side}
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' }}>
          <View style={{ flex: 3, gap: spacing.lg }}>{monthCard}</View>
          <View style={{ flex: 2, gap: spacing.lg }}>{side}</View>
        </View>
      )}
      <Card>
        <CardHeader
          title={t('op.syllabus.cardTitle')}
          subtitle={topics.length ? t('op.stats.studied', { done: studied, total: topics.length }) : undefined}
          icon="book-open"
          accent={opMeta.accent}
        />
        <OpSyllabus topics={topics} hoursByTopic={perTopic} />
      </Card>
      <OpSessionSheet
        date={openDay}
        session={openDay ? (byDate.get(openDay) ?? null) : null}
        topics={topics}
        onClose={() => setOpenDay(null)}
      />
    </Screen>
  );
}
