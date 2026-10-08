import type { DateKey } from '@/utils/date';
import type { Section, Task, TaskPriority, TaskView } from './types';

/** Pure business rules for task views — no UI, no persistence. */
export const isOpen = (t: Task) => t.status === 'pending' || t.status === 'in_progress';

export function sortTasks(tasks: Task[]): Task[] {
  return tasks.slice().sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const ad = `${a.dueDate ?? '9999'}${a.dueTime ?? '99'}`;
    const bd = `${b.dueDate ?? '9999'}${b.dueTime ?? '99'}`;
    if (ad !== bd) return ad < bd ? -1 : 1;
    return a.createdAt < b.createdAt ? -1 : 1;
  });
}

export function isOverdue(t: Task, today: DateKey): boolean {
  return isOpen(t) && !!t.dueDate && t.dueDate < today;
}

export function filterTasks(tasks: Task[], view: TaskView, today: DateKey): Task[] {
  const top = tasks.filter((t) => !t.parentTaskId);
  switch (view) {
    case 'today':
      // Due today, plus anything overdue — HOY must surface what needs attention.
      return sortTasks(top.filter((t) => isOpen(t) && !!t.dueDate && t.dueDate <= today));
    case 'inbox':
      return sortTasks(top.filter((t) => isOpen(t) && !t.projectId));
    case 'upcoming':
      return sortTasks(top.filter((t) => isOpen(t) && !!t.dueDate && t.dueDate > today));
    case 'all':
      return sortTasks(top.filter(isOpen));
    case 'priorities':
      return sortTasks(top.filter((t) => isOpen(t) && t.priority < 4));
    case 'completed':
      return top.filter((t) => t.status === 'completed').sort((a, b) => ((a.completedAt ?? '') < (b.completedAt ?? '') ? 1 : -1));
  }
}

export function taskCounts(tasks: Task[], today: DateKey) {
  const todayList = filterTasks(tasks, 'today', today);
  return {
    today: todayList.length,
    todayPriority: todayList.filter((t) => t.priority === 1).length,
    overdue: todayList.filter((t) => isOverdue(t, today)).length,
    inbox: filterTasks(tasks, 'inbox', today).length,
    upcoming: filterTasks(tasks, 'upcoming', today).length,
    all: filterTasks(tasks, 'all', today).length,
    priorities: filterTasks(tasks, 'priorities', today).length,
    completed: filterTasks(tasks, 'completed', today).length,
  };
}

/** "Próximas": open tasks with a future date, grouped by day (sorted). */
export function groupByDate(tasks: Task[]): [string, Task[]][] {
  const map = new Map<string, Task[]>();
  for (const t of tasks) if (t.dueDate) map.set(t.dueDate, [...(map.get(t.dueDate) ?? []), t]);
  return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
}

/** "Prioridades": P1 → P3 groups (empty groups omitted). */
export function groupByPriority(tasks: Task[]): [TaskPriority, Task[]][] {
  return ([1, 2, 3, 4] as TaskPriority[])
    .map((p) => [p, tasks.filter((t) => t.priority === p)] as [TaskPriority, Task[]])
    .filter(([, list]) => list.length > 0);
}

/** A project's open top-level tasks, grouped by section ("no section" first). */
export function projectGroups(tasks: Task[], projectId: string, sections: Section[]): { section: Section | null; tasks: Task[] }[] {
  const mine = sortTasks(tasks.filter((t) => t.projectId === projectId && !t.parentTaskId && isOpen(t)));
  const own = sections.filter((s) => s.projectId === projectId);
  const known = new Set(own.map((s) => s.id));
  return [
    { section: null, tasks: mine.filter((t) => !t.sectionId || !known.has(t.sectionId)) },
    ...own.map((section) => ({ section, tasks: mine.filter((t) => t.sectionId === section.id) })),
  ];
}

export function tagTasks(tasks: Task[], tagId: string): Task[] {
  return sortTasks(tasks.filter((t) => !t.parentTaskId && isOpen(t) && t.tagIds.includes(tagId)));
}

export function subtasksOf(tasks: Task[], parentId: string): Task[] {
  return tasks.filter((t) => t.parentTaskId === parentId).sort((a, b) => a.order - b.order);
}

/** Subtask progress per parent id: { done, total }. */
export function subtaskProgress(tasks: Task[]): Map<string, { done: number; total: number }> {
  const map = new Map<string, { done: number; total: number }>();
  for (const t of tasks) {
    if (!t.parentTaskId || t.status === 'archived') continue;
    const p = map.get(t.parentTaskId) ?? { done: 0, total: 0 };
    p.total += 1;
    if (t.status === 'completed') p.done += 1;
    map.set(t.parentTaskId, p);
  }
  return map;
}

/** Open tasks per project / tag (sidebar counters). */
export function openCounts(tasks: Task[]): { byProject: Map<string, number>; byTag: Map<string, number> } {
  const byProject = new Map<string, number>();
  const byTag = new Map<string, number>();
  for (const t of tasks) {
    if (t.parentTaskId || !isOpen(t)) continue;
    if (t.projectId) byProject.set(t.projectId, (byProject.get(t.projectId) ?? 0) + 1);
    for (const tag of t.tagIds) byTag.set(tag, (byTag.get(tag) ?? 0) + 1);
  }
  return { byProject, byTag };
}
