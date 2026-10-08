import { useTranslation } from 'react-i18next';

import { useDataMutation, useDataQuery } from '@/state/queryClient';
import { addDays, startOfDay, toDateKey } from '@/utils/date';
import { EventValidationError, type CalendarInput, type DayNoteInput, type EventInput, type MoveScope } from './service';

export function useCalendars() {
  return useDataQuery('calendars', [], (s) => s.calendars.listCalendars());
}

/** Occurrences in [from, from + days). Re-fetches when calendars/events change. */
export function useOccurrences(from: Date, days: number) {
  const start = startOfDay(from);
  return useDataQuery('events', [toDateKey(start), days], (s) => s.calendars.occurrencesBetween(start, addDays(start, days)));
}

const invalidateAll = ['calendars', 'events'] as const;

export function useCreateCalendar() {
  const { t } = useTranslation();
  return useDataMutation((s, input: CalendarInput) => s.calendars.createCalendar(input), {
    invalidate: [...invalidateAll],
    successMessage: t('calendars.toast.created'),
  });
}

export function useUpdateCalendar() {
  const { t } = useTranslation();
  return useDataMutation(
    (s, v: { id: string; patch: Partial<CalendarInput & { isActive: boolean }> }) => s.calendars.updateCalendar(v.id, v.patch),
    {
      invalidate: [...invalidateAll],
      successMessage: t('common.saved'),
    },
  );
}

export function useDeleteCalendar() {
  const { t } = useTranslation();
  return useDataMutation((s, id: string) => s.calendars.deleteCalendar(id), {
    invalidate: [...invalidateAll],
    successMessage: t('calendars.toast.deleted'),
  });
}

export function useSetCalendarVisible() {
  return useDataMutation((s, v: { id: string; visible: boolean }) => s.calendars.setVisible(v.id, v.visible), {
    invalidate: [...invalidateAll],
  });
}

export function useShowAllCalendars() {
  return useDataMutation((s) => s.calendars.showAll(), { invalidate: [...invalidateAll] });
}

export function useEvent(id: string | null) {
  return useDataQuery('events', ['event', id], (s) => (id ? s.calendars.getEvent(id) : Promise.resolve(null)));
}

function useEventError() {
  const { t } = useTranslation();
  return (e: unknown) => (e instanceof EventValidationError ? t(`calendars.errors.${e.field}`) : t('common.errorDescription'));
}

export function useCreateEvent() {
  const { t } = useTranslation();
  const errorMessage = useEventError();
  return useDataMutation((s, input: EventInput) => s.calendars.createEvent(input), {
    invalidate: ['events'],
    successMessage: t('calendars.toast.eventCreated'),
    errorMessage,
  });
}

export function useUpdateEvent() {
  const { t } = useTranslation();
  const errorMessage = useEventError();
  return useDataMutation((s, v: { id: string; input: EventInput }) => s.calendars.updateEvent(v.id, v.input), {
    invalidate: ['events'],
    successMessage: t('calendars.toast.eventUpdated'),
    errorMessage,
  });
}

export function useDuplicateEvent() {
  const { t } = useTranslation();
  return useDataMutation((s, id: string) => s.calendars.duplicateEvent(id), {
    invalidate: ['events'],
    successMessage: t('calendars.toast.eventDuplicated'),
  });
}

/** Deletes the whole event/series, or a single occurrence when `date` is given. */
export function useDeleteEvent() {
  const { t } = useTranslation();
  return useDataMutation(
    (s, v: { id: string; date?: string }) => (v.date ? s.calendars.deleteOccurrence(v.id, v.date) : s.calendars.deleteEvent(v.id)),
    { invalidate: ['events'], successMessage: t('calendars.toast.eventDeleted') },
  );
}

// ---------- Day notes (scope 'events': they live in the calendar views) ----------

/** Notes of the days in [from, from + days). */
export function useDayNotes(from: Date, days: number) {
  const start = toDateKey(startOfDay(from));
  const end = toDateKey(addDays(startOfDay(from), days - 1));
  return useDataQuery('events', ['notes', start, end], (s) => s.calendars.notesBetween(start, end));
}

export function useAddDayNote() {
  const { t } = useTranslation();
  return useDataMutation((s, input: DayNoteInput) => s.calendars.addDayNote(input), {
    invalidate: ['events'],
    successMessage: t('calendars.notes.toast.added'),
  });
}

export function useUpdateDayNote() {
  return useDataMutation(
    (s, v: { id: string; patch: Partial<DayNoteInput & { done: boolean }> }) => s.calendars.updateDayNote(v.id, v.patch),
    { invalidate: ['events'] },
  );
}

export function useRemoveDayNote() {
  const { t } = useTranslation();
  return useDataMutation((s, id: string) => s.calendars.removeDayNote(id), {
    invalidate: ['events'],
    successMessage: t('calendars.notes.toast.deleted'),
  });
}

/** Drag & drop of an event occurrence to another day (and time). */
export function useMoveOccurrence() {
  const { t } = useTranslation();
  return useDataMutation(
    (s, v: { id: string; from: string; to: string; toTime?: string | null; scope: MoveScope }) => s.calendars.moveOccurrence(v.id, v),
    { invalidate: ['events'], successMessage: t('calendars.move.moved') },
  );
}

export function useMoveDayNote() {
  const { t } = useTranslation();
  return useDataMutation((s, v: { id: string; date: string }) => s.calendars.moveDayNote(v.id, v.date), {
    invalidate: ['events'],
    successMessage: t('calendars.move.noteMoved'),
  });
}
