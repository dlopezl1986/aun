import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ChipGroup } from '@/components/forms/Chips';
import { useDialog } from '@/components/feedback/DialogProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Divider } from '@/components/ui/Divider';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { ListRow } from '@/components/ui/ListRow';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useLocale } from '@/hooks/useLocale';
import { useTheme } from '@/theme';
import { addDays, formatLongDate, fromDateKey, toDateKey } from '@/utils/date';
import { ProjectFormSheet } from './components/ProjectFormSheet';
import { QuickAddTask } from './components/QuickAddTask';
import { TaskDetailSheet } from './components/TaskDetailSheet';
import { TaskRow } from './components/TaskRow';
import { SMART_VIEWS, TodoNav } from './components/TodoNav';
import {
  useArchiveCompleted,
  useCreateSection,
  useDeleteProject,
  useDeleteSection,
  useDeleteTag,
  useDeleteTask,
  useRenameSection,
  useRenameTag,
  useTags,
  useTaskView,
  useTodoStructure,
  useToggleTask,
} from './hooks';
import { todoMeta } from './meta';
import { usePriorityColors } from './priority';
import { filterTasks, groupByDate, groupByPriority, openCounts, projectGroups, tagTasks } from './selectors';
import type { Project, Task, TaskView, TodoTarget } from './types';

const VIEWS: TaskView[] = SMART_VIEWS.map((v) => v.view);

function targetFromParams(p: { view?: string; project?: string; tag?: string }): TodoTarget {
  if (p.project) return { kind: 'project', projectId: p.project };
  if (p.tag) return { kind: 'tag', tagId: p.tag };
  if (p.view === 'projects') return { kind: 'projects' };
  if (p.view === 'tags') return { kind: 'tags' };
  if (p.view && (VIEWS as string[]).includes(p.view)) return { kind: 'view', view: p.view as TaskView };
  return { kind: 'view', view: 'today' };
}

function select(target: TodoTarget) {
  router.setParams({
    view: target.kind === 'view' ? target.view : target.kind === 'projects' || target.kind === 'tags' ? target.kind : undefined,
    project: target.kind === 'project' ? target.projectId : undefined,
    tag: target.kind === 'tag' ? target.tagId : undefined,
  });
}

function GroupHeader({ title, color, right, count }: { title: string; color?: string; right?: ReactNode; count?: number }) {
  const { spacing } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.sm,
        paddingTop: spacing.md,
        minHeight: 40,
      }}
    >
      {color ? <Icon name="flag" size={14} color={color} /> : null}
      <AppText variant="smallStrong" style={{ flex: 1 }} accessibilityRole="header">
        {title}
        {count !== undefined ? (
          <AppText variant="caption" tone="textSubtle">
            {'  '}
            {count}
          </AppText>
        ) : null}
      </AppText>
      {right}
    </View>
  );
}

export function TodoScreen() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { spacing } = useTheme();
  const dialog = useDialog();
  const priorityColors = usePriorityColors();
  const { breakpoint } = useBreakpoint();
  const params = useLocalSearchParams<{ view?: string; project?: string; tag?: string; task?: string }>();
  const target = targetFromParams(params);
  const sideNav = breakpoint === 'expanded' || breakpoint === 'wide';

  const { counts, today, isLoading, isError, refetch, data } = useTaskView('all');
  const all = useMemo(() => data ?? [], [data]);
  const structure = useTodoStructure();
  const tagsQuery = useTags();
  const toggle = useToggleTask();
  const del = useDeleteTask();
  const archive = useArchiveCompleted();
  const createSection = useCreateSection();
  const renameSection = useRenameSection();
  const deleteSection = useDeleteSection();
  const deleteProject = useDeleteProject();
  const renameTag = useRenameTag();
  const deleteTag = useDeleteTag();

  const [projectSheet, setProjectSheet] = useState<{ open: boolean; project: Project | null; areaId: string | null }>({
    open: false,
    project: null,
    areaId: null,
  });
  const [addingIn, setAddingIn] = useState<string | null>(null);
  const openTaskId = typeof params.task === 'string' ? params.task : null;
  const openTask = (task: Task) => router.setParams({ task: task.id });
  const closeTask = () => router.setParams({ task: undefined });

  const projects = structure.data?.projects ?? [];
  const sections = structure.data?.sections ?? [];
  const tags = tagsQuery.data ?? [];
  const project = target.kind === 'project' ? projects.find((p) => p.id === target.projectId) : undefined;
  const tag = target.kind === 'tag' ? tags.find((x) => x.id === target.tagId) : undefined;
  const { byTag } = openCounts(all);

  const onDelete = async (task: Task) => {
    const ok = await dialog.confirm({
      title: t('todo.deleteTitle'),
      message: t('todo.deleteMessage', { title: task.title }),
      confirmLabel: t('common.delete'),
      destructive: true,
    });
    if (ok) del.mutate(task.id);
  };

  const rows = (list: Task[], opts: { hideProject?: boolean; deletable?: boolean } = {}) =>
    list.map((task, i) => (
      <View key={task.id}>
        {i > 0 ? <Divider inset={40} /> : null}
        <TaskRow
          task={task}
          today={today}
          onToggle={(x) => toggle.mutate(x)}
          onOpen={openTask}
          onDelete={opts.deletable ? onDelete : undefined}
          hideProject={opts.hideProject}
        />
      </View>
    ));

  // ---------- Title of the current target ----------
  let title = t('modules.todo.title');
  let subtitle = t('todo.subtitle');
  if (target.kind === 'view') title = t(`todo.views.${target.view}`);
  if (target.kind === 'projects') title = t('todo.views.projects');
  if (target.kind === 'tags') title = t('todo.views.tags');
  if (project) {
    title = project.name;
    subtitle = t('todo.projects.subtitle');
  }
  if (tag) title = `#${tag.name}`;

  // ---------- Content ----------
  const empty = (view: TaskView) => (
    <EmptyState
      icon={SMART_VIEWS.find((v) => v.view === view)!.icon}
      accent={todoMeta.accent}
      title={t(`todo.empty.${view}.title`)}
      description={t(`todo.empty.${view}.description`)}
    />
  );

  let content: ReactNode = null;
  if (target.kind === 'view') {
    const list = filterTasks(all, target.view, today);
    if (!list.length) content = empty(target.view);
    else if (target.view === 'upcoming') {
      const tomorrow = toDateKey(addDays(fromDateKey(today), 1));
      content = groupByDate(list).map(([date, items]) => (
        <View key={date}>
          <GroupHeader
            title={
              date === tomorrow
                ? `${t('common.tomorrow')} · ${formatLongDate(fromDateKey(date), locale)}`
                : formatLongDate(fromDateKey(date), locale)
            }
            count={items.length}
          />
          {rows(items)}
        </View>
      ));
    } else if (target.view === 'priorities') {
      content = groupByPriority(list).map(([p, items]) => (
        <View key={p}>
          <GroupHeader title={t(`todo.priority.p${p}`)} color={priorityColors[p]} count={items.length} />
          {rows(items)}
        </View>
      ));
    } else if (target.view === 'completed') {
      content = (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: spacing.sm }}>
            <Button
              label={t('todo.archiveCompleted')}
              icon="archive"
              variant="secondary"
              size="sm"
              loading={archive.isPending}
              onPress={async () => {
                const ok = await dialog.confirm({
                  title: t('todo.archiveCompleted'),
                  message: t('todo.archiveMessage'),
                  confirmLabel: t('todo.archive'),
                });
                if (ok) archive.mutate();
              }}
            />
          </View>
          {rows(list, { deletable: true })}
        </>
      );
    } else content = rows(list);
  } else if (target.kind === 'project') {
    if (!project) content = <EmptyState icon="folder" title={t('todo.projects.notFound')} />;
    else {
      const groups = projectGroups(all, project.id, sections);
      const total = groups.reduce((n, g) => n + g.tasks.length, 0);
      content = (
        <>
          {groups.map(({ section, tasks }) => {
            if (!section && !tasks.length) return null;
            const key = section?.id ?? 'none';
            return (
              <View key={key}>
                {section ? (
                  <GroupHeader
                    title={section.name}
                    count={tasks.length}
                    right={
                      <>
                        <IconButton
                          icon="plus"
                          size={16}
                          label={t('todo.sections.addTask', { name: section.name })}
                          onPress={() => setAddingIn(addingIn === key ? null : key)}
                        />
                        <IconButton
                          icon="edit-2"
                          size={16}
                          label={t('todo.sections.rename')}
                          onPress={async () => {
                            const name = await dialog.prompt({
                              title: t('todo.sections.rename'),
                              label: t('todo.sections.name'),
                              initialValue: section.name,
                              confirmLabel: t('common.save'),
                            });
                            if (name && name !== section.name) renameSection.mutate({ id: section.id, name });
                          }}
                        />
                        <IconButton
                          icon="trash-2"
                          size={16}
                          label={t('todo.sections.delete')}
                          onPress={async () => {
                            const ok = await dialog.confirm({
                              title: t('todo.sections.deleteTitle', { name: section.name }),
                              message: t('todo.sections.deleteMessage'),
                              confirmLabel: t('common.delete'),
                              destructive: true,
                            });
                            if (ok) deleteSection.mutate(section.id);
                          }}
                        />
                      </>
                    }
                  />
                ) : null}
                {addingIn === key && section ? (
                  <View style={{ padding: spacing.sm }}>
                    <QuickAddTask today={today} defaultWhen="none" projectId={project.id} sectionId={section.id} autoFocus compact />
                  </View>
                ) : null}
                {rows(tasks, { hideProject: true })}
                {section && !tasks.length && addingIn !== key ? (
                  <AppText variant="caption" tone="textSubtle" style={{ paddingHorizontal: spacing.sm, paddingBottom: spacing.sm }}>
                    {t('todo.sections.empty')}
                  </AppText>
                ) : null}
              </View>
            );
          })}
          {!total && !sections.some((s) => s.projectId === project.id) ? (
            <EmptyState
              icon="folder"
              accent={project.color}
              title={t('todo.projects.emptyTitle')}
              description={t('todo.projects.emptyDescription')}
            />
          ) : null}
          <View style={{ flexDirection: 'row', padding: spacing.sm }}>
            <Button
              label={t('todo.sections.add')}
              icon="plus"
              variant="ghost"
              size="sm"
              onPress={async () => {
                const name = await dialog.prompt({
                  title: t('todo.sections.add'),
                  label: t('todo.sections.name'),
                  placeholder: t('todo.sections.placeholder'),
                  confirmLabel: t('common.create'),
                });
                if (name) createSection.mutate({ projectId: project.id, name });
              }}
            />
          </View>
        </>
      );
    }
  } else if (target.kind === 'tag') {
    const list = tag ? tagTasks(all, tag.id) : [];
    content = !tag ? (
      <EmptyState icon="hash" title={t('todo.tags.notFound')} />
    ) : list.length ? (
      rows(list)
    ) : (
      <EmptyState icon="hash" accent={tag.color} title={t('todo.tags.emptyTitle')} description={t('todo.tags.emptyDescription')} />
    );
  } else if (target.kind === 'tags') {
    content = tags.length ? (
      tags.map((x, i) => (
        <View key={x.id}>
          {i > 0 ? <Divider /> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <ListRow
                icon="hash"
                accent={x.color}
                title={x.name}
                subtitle={t('todo.tags.count', { count: byTag.get(x.id) ?? 0 })}
                onPress={() => select({ kind: 'tag', tagId: x.id })}
              />
            </View>
            <View style={{ flexDirection: 'row' }}>
              <IconButton
                icon="edit-2"
                size={16}
                label={`${t('todo.tags.rename')}: ${x.name}`}
                onPress={async () => {
                  const name = await dialog.prompt({
                    title: t('todo.tags.rename'),
                    label: t('todo.tags.name'),
                    initialValue: x.name,
                    confirmLabel: t('common.save'),
                  });
                  if (name && name !== x.name) renameTag.mutate({ id: x.id, name });
                }}
              />
              <IconButton
                icon="trash-2"
                size={16}
                label={`${t('common.delete')}: ${x.name}`}
                onPress={async () => {
                  const ok = await dialog.confirm({
                    title: t('todo.tags.deleteTitle', { name: x.name }),
                    message: t('todo.tags.deleteMessage'),
                    confirmLabel: t('common.delete'),
                    destructive: true,
                  });
                  if (ok) deleteTag.mutate(x.id);
                }}
              />
            </View>
          </View>
        </View>
      ))
    ) : (
      <EmptyState icon="hash" accent={todoMeta.accent} title={t('todo.tags.noneTitle')} description={t('todo.tags.noneDescription')} />
    );
  } else {
    content = (
      <View style={{ padding: spacing.sm }}>
        <TodoNav
          target={target}
          counts={counts}
          onSelect={select}
          onNewProject={(areaId) => setProjectSheet({ open: true, project: null, areaId })}
          projectsOnly
        />
      </View>
    );
  }

  const showQuickAdd = (target.kind === 'view' && target.view !== 'completed') || target.kind === 'project' || target.kind === 'tag';
  const quickAdd = showQuickAdd ? (
    <Card>
      <QuickAddTask
        key={JSON.stringify(target)}
        today={today}
        defaultWhen={target.kind === 'view' && (target.view === 'today' || target.view === 'all') ? 'today' : 'none'}
        projectId={project?.id}
        tagId={tag?.id}
      />
    </Card>
  ) : null;

  const headerActions = project ? (
    <View style={{ flexDirection: 'row', gap: spacing.xs }}>
      <Button
        label={t('common.edit')}
        icon="edit-2"
        variant="secondary"
        size="sm"
        onPress={() => setProjectSheet({ open: true, project, areaId: project.areaId })}
      />
      <IconButton
        icon="trash-2"
        label={t('todo.projects.delete')}
        onPress={async () => {
          const ok = await dialog.confirm({
            title: t('todo.projects.deleteTitle', { name: project.name }),
            message: t('todo.projects.deleteMessage'),
            confirmLabel: t('common.delete'),
            destructive: true,
          });
          if (ok) {
            deleteProject.mutate(project.id);
            select({ kind: 'projects' });
          }
        }}
      />
    </View>
  ) : undefined;

  const mobileTargets: { value: string; label: string }[] = [
    ...SMART_VIEWS.map(({ view }) => ({
      value: view,
      label: counts[view] && view !== 'completed' ? `${t(`todo.views.${view}`)} · ${counts[view]}` : t(`todo.views.${view}`),
    })),
    { value: 'projects', label: t('todo.views.projects') },
    { value: 'tags', label: t('todo.views.tags') },
  ];
  const mobileSelected =
    target.kind === 'view' ? target.view : target.kind === 'project' ? 'projects' : target.kind === 'tag' ? 'tags' : target.kind;

  const main = (
    <View style={{ flex: 1, gap: spacing.lg, minWidth: 0 }}>
      {quickAdd}
      <Card padded={false} style={{ paddingVertical: 8, paddingHorizontal: 8 }}>
        {isLoading || structure.isLoading ? <LoadingState /> : isError ? <ErrorState onRetry={() => void refetch()} /> : content}
      </Card>
    </View>
  );

  return (
    <Screen>
      <PageHeader
        title={title}
        subtitle={subtitle}
        icon={project ? 'folder' : tag ? 'hash' : todoMeta.icon}
        accent={project?.color ?? tag?.color ?? todoMeta.accent}
        actions={headerActions}
        onBack={!sideNav && (project || tag) ? () => select({ kind: project ? 'projects' : 'tags' }) : undefined}
      />
      {sideNav ? (
        <View style={{ flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' }}>
          <Card style={{ width: 270 }} padded={false}>
            <View style={{ padding: spacing.sm }} accessibilityRole="menu" accessibilityLabel={t('todo.viewsLabel')}>
              <TodoNav
                target={target}
                counts={counts}
                onSelect={select}
                onNewProject={(areaId) => setProjectSheet({ open: true, project: null, areaId })}
              />
            </View>
          </Card>
          {main}
        </View>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ paddingRight: spacing.md }}
          >
            <ChipGroup<string>
              accessibilityLabel={t('todo.viewsLabel')}
              options={mobileTargets}
              selected={mobileSelected}
              onToggle={(v) => select(v === 'projects' || v === 'tags' ? { kind: v } : { kind: 'view', view: v as TaskView })}
            />
          </ScrollView>
          {main}
        </>
      )}
      <ProjectFormSheet
        visible={projectSheet.open}
        project={projectSheet.project}
        defaultAreaId={projectSheet.areaId}
        onClose={() => setProjectSheet({ open: false, project: null, areaId: null })}
        onCreated={(p) => select({ kind: 'project', projectId: p.id })}
      />
      <TaskDetailSheet taskId={openTaskId} onClose={closeTask} />
    </Screen>
  );
}
