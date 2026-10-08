import type { EntityRef } from '@/types/entity';
import { router } from 'expo-router';
import { View } from 'react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Sheet } from '@/components/ui/Sheet';
import { useNow } from '@/hooks/useNow';
import { useToday } from '@/hooks/useToday';
import { StatTile } from '@/modules/dashboard/components/StatTile';
import { SummaryTile } from '@/modules/dashboard/components/SummaryTile';
import { QuickAddTask } from './components/QuickAddTask';
import { TaskRow } from './components/TaskRow';
import { useTaskView, useTasks, useToggleTask } from './hooks';
import { todoMeta } from './meta';
import { openTodoTask } from './navigation';

const ACCENT = todoMeta.accent;

export function TodayTasksWidget() {
  const { t } = useTranslation();
  const { tasks, today, isLoading, isError, refetch } = useTaskView('today');
  const toggle = useToggleTask();
  return (
    <Card style={{ flex: 1 }}>
      <CardHeader
        title={t('todo.widget.title')}
        icon="check-square"
        accent={ACCENT}
        actionLabel={t('common.viewAll')}
        onAction={() => router.navigate('/todo')}
      />
      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : tasks.length === 0 ? (
        <EmptyState
          compact
          icon="sun"
          accent={ACCENT}
          title={t('todo.empty.today.title')}
          actionLabel={t('todo.widget.add')}
          onAction={() => router.navigate('/todo')}
        />
      ) : (
        <View>
          {tasks.slice(0, 6).map((task) => (
            <TaskRow key={task.id} task={task} today={today} onToggle={(x) => toggle.mutate(x)} onOpen={(x) => openTodoTask(x.id)} />
          ))}
        </View>
      )}
    </Card>
  );
}

export function TodoTodaySummary() {
  const { t } = useTranslation();
  const { tasks, counts, isLoading } = useTaskView('today');
  return (
    <SummaryTile
      icon="check-square"
      accent={ACCENT}
      label={t('modules.todo.title')}
      loading={isLoading}
      value={counts.today === 0 ? t('todo.summary.none') : t('todo.summary.pending', { count: counts.today })}
      alert={counts.overdue > 0}
      alertLabel={counts.overdue ? t('todo.summary.overdue', { count: counts.overdue }) : undefined}
      details={[
        ...(counts.todayPriority ? [t('todo.summary.priority', { count: counts.todayPriority })] : []),
        ...(counts.overdue ? [t('todo.summary.overdue', { count: counts.overdue })] : []),
        ...tasks.slice(0, 2).map((x) => x.title),
      ]}
      onPress={() => router.navigate('/todo')}
    />
  );
}

/** "Prioridades": open P1/P2 tasks regardless of date. */
export function PrioritiesWidget() {
  const { t } = useTranslation();
  const { tasks, today, isLoading } = useTaskView('all');
  const toggle = useToggleTask();
  const important = tasks.filter((x) => x.priority <= 2);
  return (
    <Card style={{ flex: 1 }}>
      <CardHeader
        title={t('todo.priorities.title')}
        icon="flag"
        accent={ACCENT}
        actionLabel={t('common.viewAll')}
        onAction={() => router.navigate('/todo')}
      />
      {isLoading ? (
        <LoadingState />
      ) : important.length === 0 ? (
        <EmptyState compact icon="flag" accent={ACCENT} title={t('todo.priorities.empty')} description={t('todo.priorities.emptyHint')} />
      ) : (
        <View>
          {important.slice(0, 6).map((task) => (
            <TaskRow key={task.id} task={task} today={today} onToggle={(x) => toggle.mutate(x)} onOpen={(x) => openTodoTask(x.id)} />
          ))}
        </View>
      )}
    </Card>
  );
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function TodoWeeklyStats() {
  const { t } = useTranslation();
  const { data, isLoading } = useTasks();
  const now = useNow();
  const stats = useMemo(() => {
    const tasks = data ?? [];
    const since = new Date(now - WEEK_MS).toISOString();
    return {
      done: tasks.filter((x) => x.status === 'completed' && (x.completedAt ?? '') >= since).length,
      open: tasks.filter((x) => x.status === 'pending' || x.status === 'in_progress').length,
    };
  }, [data, now]);
  return (
    <>
      <StatTile icon="check-circle" accent={ACCENT} value={stats.done} label={t('todo.stats.completedWeek')} loading={isLoading} />
      <StatTile icon="list" accent={ACCENT} value={stats.open} label={t('todo.stats.open')} loading={isLoading} />
    </>
  );
}

function QuickTaskForm({ onClose, link }: { onClose: () => void; link?: EntityRef }) {
  const { t } = useTranslation();
  const today = useToday();
  return (
    <Sheet visible onClose={onClose} title={t('todo.quick.title')}>
      <QuickAddTask
        today={today}
        autoFocus
        onAdded={onClose}
        attachments={link ? [link] : undefined}
        defaultWhen={link ? 'none' : 'today'}
      />
    </Sheet>
  );
}

export function QuickTaskSheet({ visible, onClose, link }: { visible: boolean; onClose: () => void; link?: EntityRef }) {
  return visible ? <QuickTaskForm onClose={onClose} link={link} /> : null;
}
