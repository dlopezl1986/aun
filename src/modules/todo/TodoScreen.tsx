import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useDialog } from '@/components/feedback/DialogProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { interaction } from '@/components/ui/interaction';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useToday } from '@/hooks/useToday';
import { asyncKeyValueStore, storageKeys } from '@/storage/keyValueStore';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';
import { BoardView } from './board/BoardView';
import { boardColumns, GENERAL_BOARD } from './board/model';
import { ProjectFormSheet } from './components/ProjectFormSheet';
import { TaskDetailSheet } from './components/TaskDetailSheet';
import { useArchiveCompleted, useDeleteProject, useTasks, useTodoStructure } from './hooks';
import { todoMeta } from './meta';
import type { Project, Task } from './types';

const LAST_BOARD_KEY = storageKeys.device('todo:lastBoard');

/**
 * Tareas as Trello-like boards: pick a board on top, its lists sit side by
 * side and cards are dragged between them. A board is a project; "General"
 * holds the tasks that have no project.
 */
export function TodoScreen() {
  const { t } = useTranslation();
  const dialog = useDialog();
  const { spacing, radius, colors } = useTheme();
  const { isCompact } = useBreakpoint();
  const today = useToday();
  const params = useLocalSearchParams<{ board?: string; task?: string }>();

  const tasksQuery = useTasks();
  const structure = useTodoStructure();
  const deleteProject = useDeleteProject();
  const archive = useArchiveCompleted();
  const [projectSheet, setProjectSheet] = useState<{ open: boolean; project: Project | null }>({ open: false, project: null });

  // The last board you used opens again next time.
  const [remembered, setRemembered] = useState<string | null>(null);
  useEffect(() => {
    asyncKeyValueStore
      .getItem(LAST_BOARD_KEY)
      .then((v) => setRemembered(v ?? GENERAL_BOARD))
      .catch(() => setRemembered(GENERAL_BOARD));
  }, []);

  const projects = useMemo(() => (structure.data?.projects ?? []).filter((p) => !p.archived), [structure.data]);
  const sections = useMemo(() => structure.data?.sections ?? [], [structure.data]);
  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);

  const wanted = typeof params.board === 'string' ? params.board : remembered;
  const boardId = wanted && (wanted === GENERAL_BOARD || projects.some((p) => p.id === wanted)) ? wanted : GENERAL_BOARD;
  const project = projects.find((p) => p.id === boardId);

  const selectBoard = (id: string) => {
    router.setParams({ board: id });
    setRemembered(id);
    void asyncKeyValueStore.setItem(LAST_BOARD_KEY, id).catch(() => undefined);
  };

  // Opening a task from elsewhere (search, Inicio, alerts) shows its board.
  const openTaskId = typeof params.task === 'string' ? params.task : null;
  const openTaskBoard = openTaskId ? tasks.find((x) => x.id === openTaskId) : undefined;
  useEffect(() => {
    const owner = openTaskBoard ? (openTaskBoard.parentTaskId ? undefined : (openTaskBoard.projectId ?? GENERAL_BOARD)) : undefined;
    if (owner && owner !== boardId && (owner === GENERAL_BOARD || projects.some((p) => p.id === owner))) router.setParams({ board: owner });
  }, [openTaskBoard, boardId, projects]);

  const openTask = (task: Task) => router.setParams({ task: task.id });
  const closeTask = () => router.setParams({ task: undefined });

  const boards = [
    { id: GENERAL_BOARD, name: t('todo.board.general'), color: todoMeta.accent },
    ...projects.map((p) => ({ id: p.id, name: p.name, color: p.color })),
  ];
  const columns = useMemo(() => boardColumns(tasks, boardId, sections), [tasks, boardId, sections]);
  const openCount = columns.reduce((n, c) => n + c.cards.length, 0);
  const doneCount = columns.reduce((n, c) => n + c.done.length, 0);

  const boardMenu = async () => {
    const choice = await dialog.choose({
      title: project?.name ?? t('todo.board.general'),
      choices: [
        ...(doneCount ? [{ value: 'archive', label: t('todo.archiveCompleted') }] : []),
        ...(project ? [{ value: 'delete', label: t('todo.board.delete') }] : []),
        ...(project ? [{ value: 'edit', label: t('todo.board.edit') }] : []),
      ],
    });
    if (choice === 'edit' && project) setProjectSheet({ open: true, project });
    if (choice === 'archive') {
      const ok = await dialog.confirm({
        title: t('todo.archiveCompleted'),
        message: t('todo.archiveMessage'),
        confirmLabel: t('todo.archive'),
      });
      if (ok) archive.mutate();
    }
    if (choice === 'delete' && project) {
      const ok = await dialog.confirm({
        title: t('todo.board.deleteTitle', { name: project.name }),
        message: t('todo.board.deleteMessage'),
        confirmLabel: t('common.delete'),
        destructive: true,
      });
      if (ok) {
        deleteProject.mutate(project.id);
        selectBoard(GENERAL_BOARD);
      }
    }
  };

  const loading = tasksQuery.isLoading || structure.isLoading || remembered === null;

  return (
    <Screen>
      <PageHeader
        title={project?.name ?? t('modules.todo.title')}
        subtitle={openCount ? t('todo.board.subtitle', { count: openCount }) : t('todo.pending.allDone')}
        icon={project ? 'trello' : todoMeta.icon}
        accent={project?.color ?? todoMeta.accent}
      />

      {/* Board switcher */}
      <View style={isCompact ? { marginHorizontal: -spacing.lg } : undefined}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm, alignItems: 'center', paddingHorizontal: isCompact ? spacing.lg : 0 }}
          accessibilityRole="tablist"
          accessibilityLabel={t('todo.board.boards')}
        >
          {boards.map((b) => {
            const active = b.id === boardId;
            return (
              <Pressable
                key={b.id}
                onPress={() => selectBoard(b.id)}
                accessibilityRole="tab"
                aria-selected={active}
                style={(s) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  minHeight: 36,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.pill,
                  borderWidth: 1,
                  borderColor: active ? b.color : colors.border,
                  backgroundColor: active ? withAlpha(b.color, 0.16) : interaction(s).hovered ? colors.surfaceMuted : 'transparent',
                })}
              >
                <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: b.color }} />
                <AppText variant="smallStrong" color={active ? b.color : colors.textMuted} numberOfLines={1}>
                  {b.name}
                </AppText>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => setProjectSheet({ open: true, project: null })}
            accessibilityRole="button"
            accessibilityLabel={t('todo.board.new')}
            style={(s) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              minHeight: 36,
              paddingHorizontal: spacing.md,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: colors.borderStrong,
              backgroundColor: interaction(s).hovered ? colors.surfaceMuted : 'transparent',
            })}
          >
            <Icon name="plus" size={14} color={colors.textMuted} />
            <AppText variant="smallStrong" tone="textMuted">
              {t('todo.board.newShort')}
            </AppText>
          </Pressable>
          {project || doneCount ? <IconButton icon="more-horizontal" label={t('todo.board.actions')} onPress={boardMenu} /> : null}
        </ScrollView>
      </View>

      {loading ? (
        <LoadingState />
      ) : tasksQuery.isError ? (
        <ErrorState onRetry={() => void tasksQuery.refetch()} />
      ) : (
        <BoardView boardId={boardId} tasks={tasks} sections={sections} today={today} onOpen={openTask} />
      )}

      <ProjectFormSheet
        visible={projectSheet.open}
        project={projectSheet.project}
        onClose={() => setProjectSheet({ open: false, project: null })}
        onCreated={(p) => selectBoard(p.id)}
      />
      <TaskDetailSheet taskId={openTaskId} onClose={closeTask} />
    </Screen>
  );
}
