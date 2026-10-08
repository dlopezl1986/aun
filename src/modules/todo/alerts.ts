import type { AlertItem, AlertSource } from '@/types/module';
import { combine, formatShortDate, formatTime, fromDateKey, toDateKey } from '@/utils/date';
import { todoMeta } from './meta';
import { isOpen } from './selectors';

/** Task reminders (relative to the due date/time; 09:00 when the task has no time) and deadlines. */
export const taskAlertSource: AlertSource = {
  id: 'todo.reminders',
  labelKey: 'notifications.sources.tasks',
  descriptionKey: 'notifications.sources.tasksHint',
  icon: 'check-square',
  async list(services, ctx) {
    const out: AlertItem[] = [];
    const inWindow = (d: Date) => d >= ctx.from && d <= ctx.to;
    for (const task of await services.tasks.list()) {
      if (!isOpen(task)) continue;
      if (task.dueDate && task.reminders?.length) {
        const base = combine(task.dueDate, task.dueTime ?? '09:00');
        for (const minutes of task.reminders) {
          const at = new Date(base.getTime() - minutes * 60_000);
          if (!inWindow(at)) continue;
          const when = task.dueTime ? formatTime(base, ctx.locale) : ctx.t('common.today');
          out.push({
            key: `todo:${task.id}:${task.dueDate}:${minutes}`,
            moduleId: todoMeta.id,
            sourceId: 'todo.reminders',
            title: task.title,
            body:
              toDateKey(at) === task.dueDate
                ? ctx.t('notifications.alerts.taskDue', { when })
                : ctx.t('notifications.alerts.taskDue', { when: formatShortDate(fromDateKey(task.dueDate), ctx.locale) }),
            at: at.toISOString(),
            route: `/todo?task=${task.id}`,
            icon: 'check-square',
          });
        }
      }
      if (task.deadline) {
        const at = combine(task.deadline, '09:00');
        if (inWindow(at))
          out.push({
            key: `todo:${task.id}:deadline:${task.deadline}`,
            moduleId: todoMeta.id,
            sourceId: 'todo.reminders',
            title: task.title,
            body: ctx.t('notifications.alerts.deadline'),
            at: at.toISOString(),
            route: `/todo?task=${task.id}`,
            icon: 'flag',
          });
      }
    }
    return out;
  },
};
