import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useLocale } from '@/hooks/useLocale';
import { useToday } from '@/hooks/useToday';
import { useDataMutation, useDataQuery } from '@/state/queryClient';
import { accentPalette } from '@/theme';
import { colorFromString } from '@/utils/color';
import { formatShortDate, fromDateKey } from '@/utils/date';
import { filterTasks, taskCounts } from './selectors';
import type { QuickTaskInput, TaskPatch, ToggleResult } from './service';
import type { Project, Task, TaskView } from './types';

export function useTasks() {
  return useDataQuery('tasks', [], (s) => s.tasks.list());
}

export function useTaskView(view: TaskView) {
  const query = useTasks();
  const today = useToday();
  const all = query.data;
  const tasks = useMemo(() => (all ? filterTasks(all, view, today) : []), [all, view, today]);
  const counts = useMemo(() => taskCounts(all ?? [], today), [all, today]);
  return { ...query, tasks, counts, today };
}

export function useTodoStructure() {
  return useDataQuery('tasks', ['structure'], (s) => s.tasks.listStructure());
}

export function useTags() {
  return useDataQuery('tasks', ['tags'], (s) => s.tasks.listTags());
}

/** Quick add; tag names that don't exist yet are created. */
export function useQuickAddTask() {
  const { t } = useTranslation();
  return useDataMutation(
    async (s, input: QuickTaskInput & { tagNames?: string[] }) => {
      const tagIds = [...(input.tagIds ?? [])];
      for (const name of input.tagNames ?? []) tagIds.push((await s.tasks.ensureTag(name, colorFromString(name, accentPalette))).id);
      return s.tasks.quickAdd({ ...input, tagIds: [...new Set(tagIds)] });
    },
    { invalidate: ['tasks'], successMessage: t('todo.toast.added') },
  );
}

export function useToggleTask() {
  const { t } = useTranslation();
  const locale = useLocale();
  return useDataMutation((s, task: Task) => s.tasks.toggleComplete(task), {
    invalidate: ['tasks'],
    successMessage: (r: ToggleResult) =>
      r.rescheduledTo
        ? t('todo.toast.rescheduled', { date: formatShortDate(fromDateKey(r.rescheduledTo), locale) })
        : r.task.status === 'completed'
          ? t('todo.toast.completed')
          : t('todo.toast.reopened'),
  });
}

export function useUpdateTask(silent = false) {
  const { t } = useTranslation();
  return useDataMutation((s, v: { id: string; patch: TaskPatch }) => s.tasks.update(v.id, v.patch), {
    invalidate: ['tasks'],
    successMessage: silent ? undefined : t('common.saved'),
  });
}

export function useDeleteTask() {
  const { t } = useTranslation();
  return useDataMutation((s, id: string) => s.tasks.remove(id), { invalidate: ['tasks'], successMessage: t('todo.toast.deleted') });
}

export function useArchiveCompleted() {
  const { t } = useTranslation();
  return useDataMutation((s) => s.tasks.archiveCompleted(), {
    invalidate: ['tasks'],
    successMessage: (n: number) => t('todo.toast.archived', { count: n }),
  });
}

// ---------- Structure ----------

export function useCreateArea() {
  const { t } = useTranslation();
  return useDataMutation((s, name: string) => s.tasks.createArea(name, colorFromString(name, accentPalette)), {
    invalidate: ['tasks'],
    successMessage: t('todo.toast.areaCreated'),
  });
}

export function useRenameArea() {
  return useDataMutation((s, v: { id: string; name: string }) => s.tasks.renameArea(v.id, v.name), { invalidate: ['tasks'] });
}

export function useDeleteArea() {
  const { t } = useTranslation();
  return useDataMutation((s, id: string) => s.tasks.deleteArea(id), { invalidate: ['tasks'], successMessage: t('todo.toast.deleted') });
}

export function useCreateProject() {
  const { t } = useTranslation();
  return useDataMutation((s, v: { name: string; color: string; areaId: string | null }) => s.tasks.createProject(v), {
    invalidate: ['tasks'],
    successMessage: t('todo.toast.projectCreated'),
  });
}

export function useUpdateProject() {
  const { t } = useTranslation();
  return useDataMutation(
    (s, v: { id: string; patch: Partial<Pick<Project, 'name' | 'color' | 'areaId' | 'archived'>> }) => s.tasks.updateProject(v.id, v.patch),
    { invalidate: ['tasks'], successMessage: t('common.saved') },
  );
}

export function useDeleteProject() {
  const { t } = useTranslation();
  return useDataMutation((s, id: string) => s.tasks.deleteProject(id), { invalidate: ['tasks'], successMessage: t('todo.toast.deleted') });
}

export function useCreateSection() {
  return useDataMutation((s, v: { projectId: string; name: string }) => s.tasks.createSection(v.projectId, v.name), {
    invalidate: ['tasks'],
  });
}

export function useRenameSection() {
  return useDataMutation((s, v: { id: string; name: string }) => s.tasks.renameSection(v.id, v.name), { invalidate: ['tasks'] });
}

export function useDeleteSection() {
  return useDataMutation((s, id: string) => s.tasks.deleteSection(id), { invalidate: ['tasks'] });
}

export function useRenameTag() {
  return useDataMutation((s, v: { id: string; name: string }) => s.tasks.renameTag(v.id, v.name), { invalidate: ['tasks'] });
}

export function useDeleteTag() {
  const { t } = useTranslation();
  return useDataMutation((s, id: string) => s.tasks.deleteTag(id), { invalidate: ['tasks'], successMessage: t('todo.toast.deleted') });
}

export function useEnsureTag() {
  return useDataMutation((s, name: string) => s.tasks.ensureTag(name, colorFromString(name, accentPalette)), { invalidate: ['tasks'] });
}
