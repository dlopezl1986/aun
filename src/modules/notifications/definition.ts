import type { AppModule } from '@/types/module';
import { reminderAlertSource } from './alerts';
import { ReminderFormSheet } from './components/ReminderFormSheet';
import { notificationsMeta } from './meta';
import { NotificationsTodaySummary, RemindersWidget } from './widgets';

/** Core module: the central notification hub cannot be disabled. */
export const notificationsModule: AppModule = {
  id: notificationsMeta.id,
  routeName: 'notifications',
  titleKey: 'modules.notifications.title',
  descriptionKey: 'modules.notifications.description',
  icon: notificationsMeta.icon,
  accent: notificationsMeta.accent,
  kind: 'core',
  defaultEnabled: true,
  nav: { section: 'system', order: 90 },
  notificationSource: true,
  alerts: [reminderAlertSource],
  entitlement: null,
  todaySummary: NotificationsTodaySummary,
  quickActions: [{ id: 'notifications.newReminder', labelKey: 'notifications.newReminder', icon: 'bell', Sheet: ReminderFormSheet }],
  search: { search: (q, s) => s.notifications.search(q.text) },
  widgets: [
    {
      id: 'notifications.reminders',
      moduleId: notificationsMeta.id,
      titleKey: 'notifications.reminders',
      descriptionKey: 'notifications.widget.description',
      icon: 'bell',
      size: 'md',
      defaultVisible: true,
      component: RemindersWidget,
    },
  ],
};
