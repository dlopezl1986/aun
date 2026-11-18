import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useDialog } from '@/components/feedback/DialogProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Icon, type IconName } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { interaction } from '@/components/ui/interaction';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useToday } from '@/hooks/useToday';
import { asyncKeyValueStore, storageKeys } from '@/storage/keyValueStore';
import { useTheme } from '@/theme';
import { addDays, fromDateKey, toDateKey } from '@/utils/date';
import { withAlpha } from '@/utils/color';
import { BackgroundSheet } from './board/BackgroundSheet';
import { useBoardBackground } from './board/backgrounds';
import { BoardView, type GroupBy } from './board/BoardView';
import { boardColumns, GENERAL_BOARD } from './board/model';
import { ProjectFormSheet } from './components/ProjectFormSheet';
import { TaskDetailSheet } from './components/TaskDetailSheet';
import { useArchiveCompleted, useDeleteProject, useTasks, useTodoStructure } from './hooks';
import { todoMeta } from './meta';
import { usePriorityColors } from './priority';
import type { Project, Task, TaskPriority } from './types';

const LAST_BOARD_KEY = storageKeys.device('todo:lastBoard');

type DueFilter = 'overdue' | 'today' | 'week' | 'none';
const DUE_FILTERS: DueFilter[] = ['overdue', 'today', 'week', 'none'];

/** Small rounded button of the board toolbar. */
function ToolButton({
  icon,
  label,
  active,
  onPress,
  children,
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  onPress: () => void;
  children?: ReactNode;
}) {
  const { spacing, radius, colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-pressed={active}
      style={(s) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        minHeight: 34,
        paddingHorizontal: spacing.md,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active ? withAlpha(colors.primary, 0.12) : interaction(s).hovered ? colors.surfaceMuted : 'transparent',
      })}
    >
      <Icon name={icon} size={14} color={active ? colors.primary : colors.textMuted} />
      <AppText variant="smallStrong" color={active ? colors.primary : colors.textMuted}>
        {label}
      </AppText>
      {children}
    </Pressable>
  );
}

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
  const priorityColors = usePriorityColors();
  const [groupBy, setGroupBy] = useState<GroupBy>('lists');
  const [showFilters, setShowFilters] = useState(false);
  const [prioFilter, setPrioFilter] = useState<TaskPriority[]>([]);
  const [dueFilter, setDueFilter] = useState<DueFilter[]>([]);
  const [backgroundOpen, setBackgroundOpen] = useState(false);
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

  const bg = useBoardBackground(boardId, project);

  const filterCount = prioFilter.length + dueFilter.length;
  const filter = useMemo(() => {
    if (!prioFilter.length && !dueFilter.length) return null;
    const weekEnd = toDateKey(addDays(fromDateKey(today), 7));
    const dueMatch = (task: Task, f: DueFilter) =>
      f === 'none'
        ? !task.dueDate
        : !!task.dueDate &&
          (f === 'overdue'
            ? task.dueDate < today
            : f === 'today'
              ? task.dueDate === today
              : task.dueDate >= today && task.dueDate <= weekEnd);
    return (task: Task) =>
      (!prioFilter.length || prioFilter.includes(task.priority)) && (!dueFilter.length || dueFilter.some((f) => dueMatch(task, f)));
  }, [prioFilter, dueFilter, today]);
  const toggleIn = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

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
        { value: 'background', label: t('todo.background.change') },
        ...(doneCount ? [{ value: 'archive', label: t('todo.archiveCompleted') }] : []),
        ...(project ? [{ value: 'delete', label: t('todo.board.delete') }] : []),
        ...(project ? [{ value: 'edit', label: t('todo.board.edit') }] : []),
      ],
    });
    if (choice === 'background') setBackgroundOpen(true);
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
        </ScrollView>
      </View>

      {/* Toolbar: view (Listas / Prioridad), filters, background, menu */}
      <View style={{ gap: spacing.sm }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={isCompact ? { marginHorizontal: -spacing.lg } : undefined}
          contentContainerStyle={{ alignItems: 'center', gap: spacing.sm, paddingHorizontal: isCompact ? spacing.lg : 0 }}
        >
          <View
            style={{ flexDirection: 'row', padding: 3, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, gap: 2 }}
            accessibilityRole="radiogroup"
            accessibilityLabel={t('todo.board.viewBy')}
          >
            {(['lists', 'priority'] as const).map((g) => {
              const on = groupBy === g;
              return (
                <Pressable
                  key={g}
                  onPress={() => setGroupBy(g)}
                  accessibilityRole="radio"
                  aria-checked={on}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.xs,
                    minHeight: 30,
                    paddingHorizontal: spacing.md,
                    borderRadius: radius.pill,
                    backgroundColor: on ? colors.surface : 'transparent',
                    boxShadow: on ? '0 1px 3px rgba(11, 18, 32, 0.15)' : undefined,
                  }}
                >
                  <Icon name={g === 'lists' ? 'columns' : 'flag'} size={13} color={on ? colors.text : colors.textMuted} />
                  <AppText variant="smallStrong" color={on ? colors.text : colors.textMuted}>
                    {t(`todo.board.groupBy.${g}`)}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          <ToolButton
            icon="filter"
            label={filterCount ? t('todo.filter.titleCount', { count: filterCount }) : t('todo.filter.title')}
            active={showFilters || filterCount > 0}
            onPress={() => setShowFilters((v) => !v)}
          />
          <ToolButton icon="image" label={t('todo.background.short')} onPress={() => setBackgroundOpen(true)} />
          <IconButton icon="more-horizontal" label={t('todo.board.actions')} onPress={boardMenu} />
        </ScrollView>
        {showFilters ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs }}>
            {([1, 2, 3] as TaskPriority[]).map((p) => {
              const on = prioFilter.includes(p);
              const c = priorityColors[p];
              return (
                <Pressable
                  key={p}
                  onPress={() => setPrioFilter((l) => toggleIn(l, p))}
                  accessibilityRole="checkbox"
                  aria-checked={on}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    minHeight: 30,
                    paddingHorizontal: spacing.md,
                    borderRadius: radius.pill,
                    borderWidth: 1,
                    borderColor: on ? c : colors.border,
                    backgroundColor: on ? withAlpha(c, 0.14) : 'transparent',
                  }}
                >
                  <Icon name="flag" size={12} color={c} />
                  <AppText variant="caption" color={on ? c : colors.textMuted}>
                    {t(`todo.board.priorityShort${p}`)}
                  </AppText>
                </Pressable>
              );
            })}
            <View style={{ width: 1, height: 20, backgroundColor: colors.border, marginHorizontal: spacing.xs }} />
            {DUE_FILTERS.map((f) => {
              const on = dueFilter.includes(f);
              return (
                <Pressable
                  key={f}
                  onPress={() => setDueFilter((l) => toggleIn(l, f))}
                  accessibilityRole="checkbox"
                  aria-checked={on}
                  style={{
                    minHeight: 30,
                    justifyContent: 'center',
                    paddingHorizontal: spacing.md,
                    borderRadius: radius.pill,
                    borderWidth: 1,
                    borderColor: on ? colors.primary : colors.border,
                    backgroundColor: on ? withAlpha(colors.primary, 0.12) : 'transparent',
                  }}
                >
                  <AppText variant="caption" color={on ? colors.primary : colors.textMuted}>
                    {t(`todo.filter.${f}`)}
                  </AppText>
                </Pressable>
              );
            })}
            {filterCount ? (
              <Pressable
                onPress={() => {
                  setPrioFilter([]);
                  setDueFilter([]);
                }}
                accessibilityRole="button"
                style={{ minHeight: 30, justifyContent: 'center', paddingHorizontal: spacing.sm }}
              >
                <AppText variant="caption" tone="primary">
                  {t('todo.filter.clear')}
                </AppText>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      {loading ? (
        <LoadingState />
      ) : tasksQuery.isError ? (
        <ErrorState onRetry={() => void tasksQuery.refetch()} />
      ) : (
        <BoardView
          boardId={boardId}
          background={bg.background}
          groupBy={groupBy}
          filter={filter}
          tasks={tasks}
          sections={sections}
          today={today}
          onOpen={openTask}
        />
      )}

      <ProjectFormSheet
        visible={projectSheet.open}
        project={projectSheet.project}
        onClose={() => setProjectSheet({ open: false, project: null })}
        onCreated={(p) => selectBoard(p.id)}
      />
      <BackgroundSheet
        visible={backgroundOpen}
        boardId={boardId}
        value={bg.value}
        onChange={bg.set}
        onClose={() => setBackgroundOpen(false)}
      />
      <TaskDetailSheet taskId={openTaskId} onClose={closeTask} />
    </Screen>
  );
}
