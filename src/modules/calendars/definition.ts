import type { AppModule } from '@/types/module';
import { dayNoteAlertSource, eventAlertSource } from './alerts';
import { eventLinkSource, linkedEventsSource } from './links';
import { calendarsMeta } from './meta';
import { AgendaTodayWidget, CalendarsTodaySummary, CalendarsWeeklyStats, QuickEventSheet, UpcomingWidget } from './widgets';

export const calendarsModule: AppModule = {
  id: calendarsMeta.id,
  routeName: 'calendars',
  titleKey: 'modules.calendars.title',
  shortTitleKey: 'modules.calendars.short',
  descriptionKey: 'modules.calendars.description',
  icon: calendarsMeta.icon,
  accent: calendarsMeta.accent,
  kind: 'feature',
  defaultEnabled: true,
  nav: { section: 'main', order: 20, mobilePriority: 0 },
  notificationSource: true,
  alerts: [eventAlertSource, dayNoteAlertSource],
  entitlement: null,
  todaySummary: CalendarsTodaySummary,
  weeklyStats: CalendarsWeeklyStats,
  quickActions: [{ id: 'calendars.newEvent', labelKey: 'calendars.newEvent', icon: 'calendar', Sheet: QuickEventSheet }],
  linkSources: [eventLinkSource],
  related: [{ ...linkedEventsSource, Create: QuickEventSheet }],
  search: { search: (q, s) => s.calendars.search(q.text) },
  widgets: [
    {
      id: 'calendars.agenda',
      moduleId: calendarsMeta.id,
      titleKey: 'calendars.widget.title',
      descriptionKey: 'calendars.widget.description',
      icon: 'calendar',
      size: 'md',
      defaultVisible: true,
      component: AgendaTodayWidget,
    },
    {
      id: 'calendars.upcoming',
      moduleId: calendarsMeta.id,
      titleKey: 'calendars.upcoming.title',
      descriptionKey: 'calendars.upcoming.description',
      icon: 'calendar',
      size: 'md',
      defaultVisible: true,
      component: UpcomingWidget,
    },
  ],
};
