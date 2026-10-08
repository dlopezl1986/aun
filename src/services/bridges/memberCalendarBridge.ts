import type { CalendarService, EventInput } from '@/modules/calendars/service';
import type { MemberCalendarBridge } from '@/modules/family/service';
import { addDays, startOfDay, toDateKey } from '@/utils/date';
import { mondayIndex } from '@/utils/recurrence';

const plusOneHour = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return `${String(Math.min(h + 1, 23)).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/** First date from `from` (inclusive) that falls on one of the weekdays (Mon = 0). */
export function firstMatchingDay(weekdays: number[], from = new Date()): string {
  const start = startOfDay(from);
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    if (weekdays.includes(mondayIndex(d))) return toDateKey(d);
  }
  return toDateKey(start);
}

/**
 * Familia ⇄ Calendarios: each family member has a calendar, and each activity
 * with days becomes a weekly event in it (linked back to the member).
 */
export function memberCalendarBridge(calendars: CalendarService): MemberCalendarBridge {
  return {
    async createCalendar(name, color) {
      return (await calendars.createCalendar({ name, color, icon: 'user' })).id;
    },
    async updateCalendar(id, patch) {
      await calendars.updateCalendar(id, patch).catch(() => undefined); // calendar deleted by the user: nothing to sync
    },
    async upsertActivityEvent({ calendarId, eventId, activity, memberId }) {
      const startDate = firstMatchingDay(activity.weekdays);
      const input: EventInput = {
        calendarId,
        title: activity.name,
        allDay: !activity.startTime,
        startDate,
        startTime: activity.startTime ?? null,
        endDate: startDate,
        endTime: activity.startTime ? (activity.endTime ?? plusOneHour(activity.startTime)) : null,
        location: activity.place ?? null,
        notes: activity.notes ?? null,
        reminders: activity.startTime ? [30] : [],
        recurrence: { freq: 'weekly', interval: 1, byWeekday: activity.weekdays },
        links: [{ module: 'family', type: 'child', id: memberId }],
      };
      if (eventId && (await calendars.getEvent(eventId))) return (await calendars.updateEvent(eventId, input)).id;
      return (await calendars.createEvent(input)).id;
    },
    async deleteEvent(id) {
      await calendars.deleteEvent(id).catch(() => undefined);
    },
  };
}
