import type { LinkItem, LinkSource, RelatedSource } from '@/types/module';
import { matchScore } from '@/types/search';
import { formatDateInput } from '@/utils/date';
import { todoMeta } from './meta';
import type { Task } from './types';

const toItem = (task: Task): LinkItem => ({
  ref: { module: todoMeta.id, type: 'task', id: task.id },
  title: task.title,
  subtitle: task.dueDate ? formatDateInput(task.dueDate) : undefined,
  route: `/todo?task=${task.id}`,
});

/** Tasks can be related to events, documents, children… (section 48). */
export const taskLinkSource: LinkSource = {
  type: 'task',
  labelKey: 'links.sources.tasks',
  icon: 'check-square',
  async list(services, query) {
    const tasks = (await services.tasks.list()).filter((t) => t.status !== 'archived');
    return tasks.filter((t) => !query || matchScore(t.title, query) > 0).map(toItem);
  },
  async resolve(services, ids) {
    return (await services.tasks.list()).filter((t) => ids.includes(t.id)).map(toItem);
  },
};

/** Open tasks linked to an entity (e.g. "Pendientes" of a child). */
export const linkedTasksSource: RelatedSource = {
  id: 'todo.tasks',
  titleKey: 'related.tasks',
  icon: 'check-square',
  scope: 'tasks',
  createLabelKey: 'todo.quick.action',
  async list(services, ref) {
    const tasks = (await services.tasks.tasksLinkedTo(ref)).filter((t) => t.status === 'pending' || t.status === 'in_progress');
    return tasks
      .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.priority - b.priority)
      .map((t) => ({ ...toItem(t), subtitle: undefined, date: t.dueDate ?? undefined, allDay: true }));
  },
};
