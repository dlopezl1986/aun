import type { AppModule } from '@/types/module';
import { taskAlertSource } from './alerts';
import { linkedTasksSource, taskLinkSource } from './links';
import { todoMeta } from './meta';
import { PrioritiesWidget, QuickTaskSheet, TodayTasksWidget, TodoTodaySummary, TodoWeeklyStats } from './widgets';

export const todoModule: AppModule = {
  id: todoMeta.id,
  routeName: 'todo',
  titleKey: 'modules.todo.title',
  descriptionKey: 'modules.todo.description',
  icon: todoMeta.icon,
  accent: todoMeta.accent,
  kind: 'feature',
  defaultEnabled: true,
  nav: { section: 'main', order: 30, mobilePriority: 1 },
  notificationSource: true,
  alerts: [taskAlertSource],
  entitlement: null,
  todaySummary: TodoTodaySummary,
  weeklyStats: TodoWeeklyStats,
  quickActions: [{ id: 'todo.newTask', labelKey: 'todo.quick.action', icon: 'check-square', Sheet: QuickTaskSheet }],
  linkSources: [taskLinkSource],
  related: [{ ...linkedTasksSource, Create: QuickTaskSheet }],
  search: { search: (q, s) => s.tasks.search(q.text) },
  widgets: [
    {
      id: 'todo.today',
      moduleId: 'todo',
      titleKey: 'todo.widget.title',
      descriptionKey: 'todo.widget.description',
      icon: 'check-square',
      size: 'md',
      defaultVisible: true,
      component: TodayTasksWidget,
    },
    {
      id: 'todo.priorities',
      moduleId: 'todo',
      titleKey: 'todo.priorities.title',
      descriptionKey: 'todo.priorities.description',
      icon: 'flag',
      size: 'md',
      defaultVisible: true,
      component: PrioritiesWidget,
    },
  ],
};
