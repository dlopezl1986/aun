import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Card, CardHeader } from '@/components/ui/Card';
import { Divider } from '@/components/ui/Divider';
import { Icon } from '@/components/ui/Icon';
import { interaction } from '@/components/ui/interaction';
import { useNow } from '@/hooks/useNow';
import { useToday } from '@/hooks/useToday';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';
import { TaskRow } from './components/TaskRow';
import { homeTasks } from './home';
import { useTasks, useTodoStructure, useToggleTask } from './hooks';
import { todoMeta } from './meta';
import { openTodoTask } from './navigation';
import type { Task } from './types';

const MAX_ROWS = 5;

/**
 * Bottom of Inicio: pending cards, only when there are any. Cards «en curso»
 * for more than a week stand out first, so they get finished.
 */
export function HomeTasksCard() {
  const { t } = useTranslation();
  const { spacing, radius, colors, mode } = useTheme();
  const today = useToday();
  const now = useNow(60_000);
  const tasks = useTasks();
  const structure = useTodoStructure();
  const toggle = useToggleTask();

  const data = useMemo(() => homeTasks(tasks.data ?? [], structure.data?.sections ?? [], now), [tasks.data, structure.data, now]);
  const boardName = (task: Task) =>
    task.projectId ? (structure.data?.projects.find((p) => p.id === task.projectId)?.name ?? '') : t('todo.board.general');

  if (!data.total) return null;
  const shown = data.others.slice(0, MAX_ROWS);
  const more = data.others.length - shown.length;

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

      {data.stale.length ? (
        <View
          accessibilityRole="alert"
          style={{
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: withAlpha(colors.danger, 0.35),
            borderLeftWidth: 5,
            borderLeftColor: colors.danger,
            backgroundColor: mode === 'dark' ? withAlpha(colors.danger, 0.14) : colors.dangerSoft,
            padding: spacing.md,
            gap: spacing.sm,
            marginBottom: data.others.length ? spacing.md : 0,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Icon name="alert-triangle" size={18} color={colors.danger} />
            <AppText variant="bodyStrong" color={colors.danger} style={{ flex: 1 }}>
              {t('todo.home.staleTitle', { count: data.stale.length })}
            </AppText>
          </View>
          <AppText variant="small" tone="textMuted">
            {t('todo.home.staleImpact')}
          </AppText>
          {data.stale.map(({ task, days }) => (
            <Pressable
              key={task.id}
              onPress={() => openTodoTask(task.id)}
              accessibilityRole="button"
              accessibilityLabel={`${task.title}, ${t('todo.home.staleDays', { count: days })}`}
              style={(s) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                padding: spacing.sm,
                borderRadius: radius.sm,
                backgroundColor: interaction(s).hovered ? colors.surfaceMuted : colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              })}
            >
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong" numberOfLines={2}>
                  {task.title}
                </AppText>
                <AppText variant="caption" tone="textSubtle" numberOfLines={1}>
                  {boardName(task)}
                </AppText>
              </View>
              <View
                style={{
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 3,
                  borderRadius: radius.pill,
                  backgroundColor: colors.danger,
                }}
              >
                <AppText variant="caption" color="#FFFFFF">
                  {t('todo.home.staleDays', { count: days })}
                </AppText>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      {shown.map((task, i) => (
        <View key={task.id}>
          {i > 0 ? <Divider inset={40} /> : null}
          <TaskRow task={task} today={today} onToggle={(x) => toggle.mutate(x)} onOpen={(x) => openTodoTask(x.id)} />
        </View>
      ))}
      {more > 0 ? (
        <Pressable onPress={() => router.navigate('/todo')} accessibilityRole="link" style={{ paddingTop: spacing.sm, paddingLeft: 40 }}>
          <AppText variant="smallStrong" tone="primary">
            {t('todo.home.more', { count: more })}
          </AppText>
        </Pressable>
      ) : null}
    </Card>
  );
}
