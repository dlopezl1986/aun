import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Card, CardHeader } from '@/components/ui/Card';
import { Divider } from '@/components/ui/Divider';
import { Sheet } from '@/components/ui/Sheet';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useLocale } from '@/hooks/useLocale';
import { useToday } from '@/hooks/useToday';
import { formatHours } from '@/modules/calendars/shiftHours';
import { useTheme } from '@/theme';
import { DayCard, TopicPickerSheet } from './components/DayCard';
import { SyllabusSetup } from './components/SyllabusSetup';
import { TileLegend, TopicGrid, type TileState } from './components/TopicGrid';
import { topicLabel } from './components/topicLabel';
import { TopicSheet } from './components/TopicSheet';
import { WeekStrip } from './components/WeekStrip';
import { useOpSessions, useOpTopics } from './hooks';
import { opMeta } from './meta';
import { hoursPerTopic, opTotals } from './service';

/** Hours today / this week / in total, and how much of the syllabus is studied. */
function Progress({ totals, studied, total }: { totals: ReturnType<typeof opTotals>; studied: number; total: number }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { spacing, radius, colors } = useTheme();
  const accent = opMeta.accent;
  const share = total ? studied / total : 0;
  const stat = (label: string, hours: number) => (
    <View style={{ flex: 1, gap: 2 }}>
      <AppText variant="caption" tone="textMuted">
        {label}
      </AppText>
      <AppText variant="heading" color={accent}>
        {formatHours(hours, locale)}
      </AppText>
    </View>
  );
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        {stat(t('op.stats.today'), totals.today)}
        {stat(t('op.stats.week'), totals.week)}
        {stat(t('op.stats.total'), totals.total)}
      </View>
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <AppText variant="small">{t('op.stats.studied', { done: studied, total })}</AppText>
          <AppText variant="smallStrong" color={accent}>
            {`${Math.round(share * 100)} %`}
          </AppText>
        </View>
        <View style={{ height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: 'hidden' }}>
          <View style={{ width: `${share * 100}%`, height: '100%', borderRadius: radius.pill, backgroundColor: accent }} />
        </View>
      </View>
    </View>
  );
}

export function OpScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { isCompact } = useBreakpoint();
  const today = useToday();
  const topicsQuery = useOpTopics();
  const sessionsQuery = useOpSessions();

  const [selected, setSelected] = useState(today);
  const [picking, setPicking] = useState(false);
  const [addingTopics, setAddingTopics] = useState(false);
  const [topicId, setTopicId] = useState<string | null>(null);

  const topics = useMemo(() => topicsQuery.data ?? [], [topicsQuery.data]);
  const sessions = useMemo(() => sessionsQuery.data ?? [], [sessionsQuery.data]);
  const byDate = useMemo(() => new Map(sessions.map((s) => [s.date, s])), [sessions]);
  const perTopic = useMemo(() => hoursPerTopic(sessions), [sessions]);
  const upcoming = useMemo(() => new Set(sessions.filter((s) => s.date >= today).flatMap((s) => s.topicIds)), [sessions, today]);
  const session = byDate.get(selected) ?? null;
  const studied = topics.filter((x) => x.studied).length;

  const header = <PageHeader title={t('modules.op.title')} subtitle={t('op.subtitle')} icon={opMeta.icon} accent={opMeta.accent} />;

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

  // First time: build the syllabus (how many topics, leave out the ones you skip).
  if (!topics.length) {
    return (
      <Screen maxWidth={760}>
        {header}
        <Card>
          <View style={{ gap: spacing.lg }}>
            <View style={{ gap: spacing.xs }}>
              <AppText variant="title">{t('op.setup.title')}</AppText>
              <AppText tone="textMuted">{t('op.setup.description')}</AppText>
            </View>
            <SyllabusSetup existing={[]} />
          </View>
        </Card>
      </Screen>
    );
  }

  const tileState = (id: string, isStudied: boolean): TileState =>
    isStudied ? 'studied' : session?.topicIds.includes(id) ? 'chosen' : upcoming.has(id) ? 'planned' : 'idle';
  const openTopic = topics.find((x) => x.id === topicId) ?? null;

  const dayCard = (
    <Card>
      <View style={{ gap: spacing.lg }}>
        <WeekStrip selected={selected} today={today} sessions={byDate} onSelect={setSelected} />
        <Divider />
        <DayCard key={selected} date={selected} today={today} session={session} topics={topics} onPickTopics={() => setPicking(true)} />
      </View>
    </Card>
  );

  const progress = (
    <Card>
      <Progress totals={opTotals(sessions, today)} studied={studied} total={topics.length} />
    </Card>
  );

  const syllabus = (
    <Card>
      <CardHeader
        title={t('op.syllabus.cardTitle')}
        subtitle={t('op.syllabus.hint')}
        icon="book-open"
        accent={opMeta.accent}
        actionLabel={t('op.syllabus.addMore')}
        onAction={() => setAddingTopics(true)}
      />
      <View style={{ gap: spacing.md }}>
        <TopicGrid
          tiles={topics.map((x) => {
            const state = tileState(x.id, x.studied);
            return { key: x.id, number: x.number, state, label: `${topicLabel(x, t)}, ${t(`op.legend.${state}`)}` };
          })}
          onPress={(tile) => setTopicId(tile.key)}
        />
        <TileLegend states={['idle', 'planned', 'chosen', 'studied']} />
      </View>
    </Card>
  );

  return (
    <Screen maxWidth={1100}>
      {header}
      {isCompact ? (
        <View style={{ gap: spacing.lg }}>
          {progress}
          {dayCard}
          {syllabus}
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' }}>
          <View style={{ flex: 5, gap: spacing.lg }}>{dayCard}</View>
          <View style={{ flex: 4, gap: spacing.lg }}>
            {progress}
            {syllabus}
          </View>
        </View>
      )}
      {picking ? <TopicPickerSheet date={selected} session={session} topics={topics} onClose={() => setPicking(false)} /> : null}
      <TopicSheet
        topic={openTopic}
        sessions={sessions}
        day={{ date: selected, session }}
        hours={openTopic ? (perTopic.get(openTopic.id) ?? 0) : 0}
        onClose={() => setTopicId(null)}
      />
      {addingTopics ? (
        <Sheet visible onClose={() => setAddingTopics(false)} title={t('op.syllabus.addMore')} subtitle={t('op.setup.addDescription')}>
          <SyllabusSetup existing={topics.map((x) => x.number)} onDone={() => setAddingTopics(false)} />
        </Sheet>
      ) : null}
    </Screen>
  );
}
