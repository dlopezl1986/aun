import { useTranslation } from 'react-i18next';

import { useDataMutation, useDataQuery } from '@/state/queryClient';
import { opMeta } from './meta';
import type { OpCalendarLook, SessionPatch } from './service';

/** Name / colour of the user's "Oposición" calendar. */
export function useOpLook(): OpCalendarLook {
  const { t } = useTranslation();
  return { name: t('op.calendarName'), color: opMeta.accent };
}

const ALL = ['op', 'events', 'calendars'] as const;

export function useOpTopics() {
  return useDataQuery('op', ['topics'], (s) => s.op.listTopics());
}

export function useOpSessions() {
  return useDataQuery('op', ['sessions'], (s) => s.op.listSessions());
}

export function useCarriedNotes(date: string) {
  return useDataQuery('op', ['carried', date], (s) => s.op.carriedNotes(date));
}

export function useAddTopic() {
  return useDataMutation((s, v: { number: number; title: string }) => s.op.addTopic(v.number, v.title), { invalidate: ['op'] });
}

export function useAddTopicRange() {
  const { t } = useTranslation();
  return useDataMutation((s, v: { from: number; to: number }) => s.op.addTopicRange(v.from, v.to), {
    invalidate: ['op'],
    successMessage: (n) => t('op.syllabus.added', { count: n }),
  });
}

export function useUpdateTopic() {
  return useDataMutation(
    (s, v: { id: string; patch: { number?: number; title?: string; studied?: boolean } }) => s.op.updateTopic(v.id, v.patch),
    { invalidate: ['op'] },
  );
}

export function useRemoveTopic() {
  const look = useOpLook();
  return useDataMutation((s, id: string) => s.op.removeTopic(id, look), { invalidate: [...ALL] });
}

/** Plan mode: one tap on a day (no toast: taps come in quick runs). */
export function usePlanDay() {
  const look = useOpLook();
  return useDataMutation((s, v: { date: string; topicIds: string[] }) => s.op.planDay(v.date, v.topicIds, look), {
    invalidate: [...ALL],
  });
}

export function useSaveSession() {
  const { t } = useTranslation();
  const look = useOpLook();
  return useDataMutation(
    (s, v: { id: string | null; date: string; patch: SessionPatch }) =>
      v.id ? s.op.updateSession(v.id, v.patch, look) : s.op.createSession(v.date, v.patch, look),
    { invalidate: [...ALL], successMessage: t('common.saved') },
  );
}

export function useRemoveSession() {
  const { t } = useTranslation();
  return useDataMutation((s, id: string) => s.op.removeSession(id), {
    invalidate: [...ALL],
    successMessage: t('op.session.deleted'),
  });
}

export function useAddTopics() {
  const { t } = useTranslation();
  return useDataMutation((s, numbers: number[]) => s.op.addTopics(numbers), {
    invalidate: ['op'],
    successMessage: (n) => t('op.syllabus.added', { count: n }),
  });
}

/** Any change to a day (topics, done, hours, notes): saved at once, no toast. */
export function useSetDay() {
  const look = useOpLook();
  return useDataMutation((s, v: { date: string; patch: SessionPatch }) => s.op.setDay(v.date, v.patch, look), {
    invalidate: [...ALL],
  });
}
