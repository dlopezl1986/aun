import type { LinkItem, LinkSource, RelatedSource } from '@/types/module';
import { matchScore } from '@/types/search';
import { formatDateInput, toDateKey } from '@/utils/date';
import { calendarsMeta } from './meta';
import type { Calendar, CalendarEvent } from './types';

const toItem = ({ event, calendar }: { event: CalendarEvent; calendar: Calendar }): LinkItem => ({
  ref: { module: calendarsMeta.id, type: 'event', id: event.id },
  title: event.title,
  subtitle: `${formatDateInput(toDateKey(new Date(event.start)))} · ${calendar.name}`,
  color: calendar.color,
  route: `/calendars?event=${event.id}`,
});

/** Events can be related to tasks and other entities (section 48). */
export const eventLinkSource: LinkSource = {
  type: 'event',
  labelKey: 'links.sources.events',
  icon: 'calendar',
  async list(services, query) {
    const items = await services.calendars.linkableEvents();
    return items.filter((i) => !query || matchScore(i.event.title, query) > 0).map(toItem);
  },
  async resolve(services, ids) {
    const items = await services.calendars.linkableEvents();
    return items.filter((i) => ids.includes(i.event.id)).map(toItem);
  },
};

/** Upcoming events linked to an entity (e.g. "Próximos eventos" of a child). */
export const linkedEventsSource: RelatedSource = {
  id: 'calendars.events',
  titleKey: 'related.events',
  icon: 'calendar',
  scope: 'events',
  createLabelKey: 'calendars.newEvent',
  async list(services, ref, today, context) {
    const occurrences = await services.calendars.linkedOccurrences(ref, new Date(`${today}T00:00:00`), 60, context?.calendarId);
    // A recurring event shows only its next occurrence.
    const seen = new Set<string>();
    const next = occurrences.filter((o) => !seen.has(o.event.id) && seen.add(o.event.id));
    return next.slice(0, 8).map((o) => ({
      ref: { module: calendarsMeta.id, type: 'event', id: o.event.id },
      title: o.event.title,
      subtitle: o.event.recurrence ? `${o.calendar.name} · ↻` : o.calendar.name,
      color: o.calendar.color,
      date: o.start.toISOString(),
      allDay: o.event.allDay,
      route: `/calendars?event=${o.event.id}`,
    }));
  },
};
