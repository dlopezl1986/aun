import { useTranslation } from 'react-i18next';

import { useAppPreferences } from '@/state/appPreferences';
import { useDataMutation, useDataQuery } from '@/state/queryClient';
import { addDays, startOfDay, toDateKey } from '@/utils/date';
import { EventValidationError, type CalendarInput, type DayNoteInput, type EventInput, type MoveScope } from './service';
import type { ShiftTypeInput } from './shiftTypes';
import type { CalendarEvent } from './types';

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

export function useDuplicateCalendar() {
  const { t } = useTranslation();
  return useDataMutation((s, v: { id: string; withEvents: boolean; name: string }) => s.calendars.duplicateCalendar(v.id, v), {
    invalidate: [...invalidateAll],
    successMessage: t('calendars.duplicateCal.done'),
  });
}

// ---------- Shift mode ----------

export function useShiftTypes() {
  return useDataQuery('calendars', ['shiftTypes'], (s) => s.shiftTypes.list());
}

/** First time in shift mode: Mañana, Tarde, Noche and Libre (with the hours already used in the event form). */
export function useEnsureShiftTypes() {
  const { t } = useTranslation();
  const hours = useAppPreferences((s) => s.shiftHours);
  const colors = useAppPreferences((s) => s.shiftColors);
  return useDataMutation(
    async (s) => {
      const names = {
        morning: t('calendars.shifts.names.morning'),
        afternoon: t('calendars.shifts.names.afternoon'),
        night: t('calendars.shifts.names.night'),
        off: t('calendars.shiftMode.dayOff'),
      };
      // Corrected hours on labels also correct the shifts already painted with the old ones.
      const corrections = await s.shiftTypes.fixHours(names);
      if (corrections.length) await s.calendars.recountShiftHours(corrections);
      return s.shiftTypes.ensureDefaults(names, { hours, colors });
    },
    { invalidate: ['calendars', 'events'] },
  );
}

export function useSaveShiftType() {
  const { t } = useTranslation();
  return useDataMutation(
    (s, v: { id: string | null; input: ShiftTypeInput }) => (v.id ? s.shiftTypes.update(v.id, v.input) : s.shiftTypes.create(v.input)),
    { invalidate: ['calendars'], successMessage: t('common.saved') },
  );
}

export function useDeleteShiftType() {
  return useDataMutation((s, id: string) => s.shiftTypes.remove(id), { invalidate: ['calendars'] });
}

export type ShiftChange = { added: CalendarEvent[]; removed: CalendarEvent[] };

/** One tap in shift mode: paint a shift, or erase the day's shifts (no toast: taps come in quick runs). */
export function usePaintShift() {
  return useDataMutation(
    async (s, v: { typeId: string | null; calendarId: string; date: string }): Promise<ShiftChange> => {
      if (!v.typeId) return s.calendars.eraseShifts(v.calendarId, v.date);
      // The label as it is now (hours / times may have just changed), never a copy kept by the screen.
      const type = (await s.shiftTypes.list()).find((x) => x.id === v.typeId);
      if (!type) return { added: [], removed: [] };
      return s.calendars.paintShift(type, v.calendarId, v.date);
    },
    { invalidate: ['events'] },
  );
}

export function useUndoShiftChange() {
  return useDataMutation((s, change: ShiftChange) => s.calendars.undoShiftChange(change), { invalidate: ['events'] });
}
