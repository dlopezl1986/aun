import type { AlertSource } from '@/types/module';
import { addDays, combine, formatShortDate, formatTime, toDateKey } from '@/utils/date';
import { calendarsMeta } from './meta';

/** Event reminders ("15 min antes", "1 día antes"…) of every occurrence, recurring ones included. */
export const eventAlertSource: AlertSource = {
  id: 'calendars.reminders',
  labelKey: 'notifications.sources.events',
  descriptionKey: 'notifications.sources.eventsHint',
  icon: 'calendar',
  async list(services, ctx) {
    // Reminders fire before the event: look a little beyond the window.
    const occurrences = await services.calendars.occurrencesBetween(ctx.from, addDays(ctx.to, 8), { includeHidden: true });
    const out = [];
    for (const o of occurrences) {
      const base = o.event.allDay ? combine(toDateKey(o.start), '09:00') : o.start;
      for (const minutes of o.event.reminders ?? []) {
        const at = new Date(base.getTime() - minutes * 60_000);
        if (at < ctx.from || at > ctx.to) continue;
        const sameDay = toDateKey(at) === toDateKey(o.start);
        const when = o.event.allDay ? ctx.t('calendars.allDay') : formatTime(o.start, ctx.locale);
        out.push({
          key: `calendars:${o.key}:${minutes}`,
          moduleId: calendarsMeta.id,
          sourceId: 'calendars.reminders',
          title: o.event.title,
          body: [sameDay ? when : `${formatShortDate(o.start, ctx.locale)} · ${when}`, o.calendar.name, o.event.location]
            .filter(Boolean)
            .join(' · '),
          at: at.toISOString(),
          route: `/calendars?event=${o.event.id}`,
          icon: 'calendar' as const,
          color: o.calendar.color,
        });
      }
    }
    return out;
  },
};

/** Day notes with an alert time ("Avisarme a las 10:00"). Done notes stay quiet. */
export const dayNoteAlertSource: AlertSource = {
  id: 'calendars.notes',
  labelKey: 'notifications.sources.dayNotes',
  descriptionKey: 'notifications.sources.dayNotesHint',
  icon: 'bookmark',
  async list(services, ctx) {
    const notes = await services.calendars.notesBetween(toDateKey(ctx.from), toDateKey(ctx.to));
    return notes
      .filter((n) => n.remindAt && !n.done)
      .map((n) => ({ note: n, at: combine(n.date, n.remindAt) }))
      .filter(({ at }) => at >= ctx.from && at <= ctx.to)
      .map(({ note, at }) => ({
        key: `calendars:note:${note.id}:${note.date}:${note.remindAt}`,
        moduleId: calendarsMeta.id,
        sourceId: 'calendars.notes',
        title: note.text,
        body: ctx.t('calendars.notes.alertBody'),
        at: at.toISOString(),
        route: `/calendars?day=${note.date}`,
        icon: 'bookmark' as const,
        color: note.color,
      }));
  },
};
