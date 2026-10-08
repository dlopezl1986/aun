import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useServices } from '@/services/ServicesProvider';
import { useSyncNow } from '@/services/sync/useAutoSync';
import { useDataMutation, useDataQuery } from '@/state/queryClient';
import type { InviteInput } from './firebaseSharing';
import { calendarSpaceId, canEditCalendar, roleIn, type ShareRole, type Space } from './spaces';

/** Spaces I belong to (empty without Firebase). */
export function useSharing() {
  const services = useServices();
  const q = useDataQuery('sharing', ['spaces'], (s) => (s.sharing ? s.sharing.spaces() : Promise.resolve([] as Space[])));
  return { enabled: !!services.sharing, me: services.userId, spaces: q.data ?? [], query: q };
}

/** What I can do with each calendar, and whose it is. */
export function useCalendarAccess() {
  const { me, spaces } = useSharing();
  const canEdit = useCallback((c: { id: string; ownerId: string }) => canEditCalendar(spaces, c, me), [spaces, me]);
  const isMine = useCallback((c: { ownerId: string }) => c.ownerId === me, [me]);
  const spaceOf = useCallback(
    (c: { id: string; ownerId: string }) => spaces.find((s) => s.id === calendarSpaceId(c.ownerId, c.id)),
    [spaces],
  );
  /** Who shares it with me ("David"), for calendars that are not mine. */
  const ownerName = useCallback(
    (c: { id: string; ownerId: string }) => (c.ownerId === me ? null : (spaceOf(c)?.names[c.ownerId] ?? '')),
    [me, spaceOf],
  );
  const role = useCallback((c: { id: string; ownerId: string }) => roleIn(spaces, calendarSpaceId(c.ownerId, c.id), me), [spaces, me]);
  /** Calendar assigned to me by someone else ("tu calendario"). */
  const assignedToMe = useMemo(() => spaces.find((s) => s.kind === 'calendar' && s.assignee === me)?.refId ?? null, [spaces, me]);
  return { me, canEdit, isMine, ownerName, role, spaceOf, assignedToMe };
}

export function useMyInvites() {
  return useDataQuery('sharing', ['invites'], (s) => (s.sharing ? s.sharing.myInvites() : Promise.resolve([])));
}

export function useCreateInvite() {
  return useDataMutation((s, input: InviteInput) => s.sharing!.createInvite(input), { invalidate: ['sharing'] });
}

export function useDeleteInvite() {
  const { t } = useTranslation();
  return useDataMutation((s, code: string) => s.sharing!.deleteInvite(code), {
    invalidate: ['sharing'],
    successMessage: t('sharing.toast.inviteDeleted'),
  });
}

export function useSetAccess() {
  const { t } = useTranslation();
  const syncNow = useSyncNow();
  return useDataMutation(
    async (
      s,
      v: {
        person: { uid: string; name: string };
        changes: { spaceId: string; role: ShareRole | null; def: { kind: Space['kind']; refId: string | null; name: string } }[];
        assign?: string | null;
      },
    ) => {
      await s.sharing!.setAccess(v.person, v.changes, v.assign);
      void syncNow();
    },
    { invalidate: ['sharing', 'calendars', 'events'], successMessage: t('sharing.toast.accessSaved') },
  );
}
