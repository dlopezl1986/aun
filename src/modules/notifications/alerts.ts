import type { AlertSource } from '@/types/module';
import { notificationsMeta } from './meta';

/** Manual reminders ("Recordarme comprar el regalo", viernes 18:00), recurring ones expanded. */
export const reminderAlertSource: AlertSource = {
  id: 'notifications.reminders',
  labelKey: 'notifications.sources.reminders',
  descriptionKey: 'notifications.sources.remindersHint',
  icon: 'bell',
  async list(services, ctx) {
    const occurrences = await services.notifications.reminderOccurrences(ctx.from, ctx.to);
    return occurrences.map(({ reminder, at }) => ({
      key: `reminder:${reminder.id}:${at.toISOString()}`,
      moduleId: notificationsMeta.id,
      sourceId: 'notifications.reminders',
      title: reminder.title,
      body: reminder.recurrence ? ctx.t('notifications.alerts.recurring') : undefined,
      at: at.toISOString(),
      route: '/notifications',
      icon: 'bell' as const,
    }));
  },
};
