import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Card, CardHeader } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { interaction } from '@/components/ui/interaction';
import { useNow } from '@/hooks/useNow';
import { useToday } from '@/hooks/useToday';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';
import { GENERAL_BOARD } from './board/model';
import { TaskRow } from './components/TaskRow';
import { homeBoards, type HomeBoard } from './home';
import { useTasks, useTodoStructure, useToggleTask } from './hooks';
import { todoMeta } from './meta';
import { openTodoTask } from './navigation';
import type { Task } from './types';

const MAX_ROWS = 5;

const openBoard = (boardId: string) => router.navigate({ pathname: '/todo', params: { board: boardId } });

/**
 * Bottom of Inicio: pending cards, only when there are any, one small
 * container per board (General, Trabajo…), one under the other. Cards
 * unfinished for more than a week stand out in red.
 */
export function HomeTasksCard() {
  const { t } = useTranslation();
  const { spacing, radius, colors, mode } = useTheme();
  const now = useNow(60_000);
  const tasks = useTasks();
  const structure = useTodoStructure();

  const projects = structure.data?.projects;
  const data = useMemo(
    () => homeBoards(tasks.data ?? [], structure.data?.sections ?? [], projects ?? [], now),
    [tasks.data, structure.data, projects, now],
  );
  const boardInfo = (boardId: string) => {
    const p = boardId === GENERAL_BOARD ? undefined : projects?.find((x) => x.id === boardId);
    return p ? { name: p.name, color: p.color } : { name: t('todo.board.general'), color: todoMeta.accent };
  };

  if (!data.total) return null;

  return (
    <Card>
      <CardHeader
        title={t('todo.home.title')}
        subtitle={t('todo.home.subtitle', { count: data.total })}
        icon="check-square"
        accent={todoMeta.accent}
        actionLabel={t('todo.home.open')}
        onAction={() => router.navigate('/todo')}
      />

      {data.staleCount ? (
        <View
          accessibilityRole="alert"
          style={{
            borderRadius: radius.md,
            borderLeftWidth: 5,
            borderLeftColor: colors.danger,
            backgroundColor: mode === 'dark' ? withAlpha(colors.danger, 0.14) : colors.dangerSoft,
            padding: spacing.md,
            gap: spacing.xs,
            marginBottom: spacing.md,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Icon name="alert-triangle" size={18} color={colors.danger} />
            <AppText variant="bodyStrong" color={colors.danger} style={{ flex: 1 }}>
              {t('todo.home.staleTitle', { count: data.staleCount })}
            </AppText>
          </View>
          <AppText variant="small" tone="textMuted">
            {t('todo.home.staleImpact')}
          </AppText>
        </View>
      ) : null}

      <View style={{ gap: spacing.md }}>
        {data.boards.map((board) => (
          <BoardGroup key={board.boardId} board={board} {...boardInfo(board.boardId)} />
        ))}
      </View>
    </Card>
  );
}

/** One board's container: its name on top, its pending cards underneath. */
function BoardGroup({ board, name, color }: { board: HomeBoard; name: string; color: string }) {
  const { t } = useTranslation();
  const { spacing, radius, colors } = useTheme();
  const today = useToday();
  const toggle = useToggleTask();
  const shown = board.items.slice(0, MAX_ROWS);
  const more = board.items.length - shown.length;

  return (
    <View
      style={{
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        borderTopWidth: 4,
        borderTopColor: color,
        backgroundColor: colors.surface,
        padding: spacing.sm,
        gap: spacing.xs,
      }}
    >
      <Pressable
        onPress={() => openBoard(board.boardId)}
        accessibilityRole="link"
        accessibilityLabel={t('todo.home.openBoard', { name })}
        style={(s) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.xs,
          paddingVertical: spacing.xs,
          borderRadius: radius.sm,
          backgroundColor: interaction(s).hovered ? colors.surfaceMuted : 'transparent',
        })}
      >
        <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
        <AppText variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
          {name}
        </AppText>
        <View
          style={{ paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted }}
        >
          <AppText variant="caption" tone="textMuted">
            {board.items.length}
          </AppText>
        </View>
        <Icon name="chevron-right" size={16} color={colors.textSubtle} />
      </Pressable>

      {shown.map(({ task, days }) => (
        <Row key={task.id} task={task} days={days} today={today} onToggle={(x) => toggle.mutate(x)} />
      ))}
      {more > 0 ? (
        <Pressable
          onPress={() => openBoard(board.boardId)}
          accessibilityRole="link"
          style={{ paddingVertical: spacing.xs, paddingLeft: 40 }}
        >
          <AppText variant="smallStrong" tone="primary">
            {t('todo.home.more', { count: more })}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

/** A pending card; red when it has been unfinished for more than a week. */
function Row({ task, days, today, onToggle }: { task: Task; days: number | null; today: string; onToggle: (t: Task) => void }) {
  const { t } = useTranslation();
  const { spacing, radius, colors, mode } = useTheme();
  const stale = days !== null;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingRight: stale ? spacing.sm : 0,
        borderRadius: radius.sm,
        borderLeftWidth: stale ? 4 : 0,
        borderLeftColor: colors.danger,
        backgroundColor: stale ? (mode === 'dark' ? withAlpha(colors.danger, 0.14) : colors.dangerSoft) : 'transparent',
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <TaskRow task={task} today={today} hideProject onToggle={onToggle} onOpen={(x) => openTodoTask(x.id)} />
      </View>
      {stale ? (
        <View style={{ paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.danger }}>
          <AppText variant="caption" color="#FFFFFF">
            {t('todo.home.staleDays', { count: days })}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}
