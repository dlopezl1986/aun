import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { useToday } from '@/hooks/useToday';
import { useServices } from '@/services/ServicesProvider';
import { useDataMutation, useDataQuery } from '@/state/queryClient';
import { getStorageProvider } from '@/storage/providers/factory';
import type { StoredFileRef, UploadSource } from '@/storage/providers/types';
import type { ActivityInput, ChildInput, ItemInput, MemberInput } from './service';
import type { Child, FamilyItem, FamilyListKind } from './types';

export function useChildren() {
  return useDataQuery('family', ['children'], (s) => s.family.listChildren());
}

export function useChild(id: string | null) {
  return useDataQuery('family', ['child', id], (s) => (id ? s.family.getChild(id) : Promise.resolve(null)));
}

export function useFamilyList(list: FamilyListKind) {
  const today = useToday();
  return useDataQuery('family', ['items', list, today], (s) => s.family.listItems(list, today));
}

export function useKnownStores() {
  return useDataQuery('family', ['stores'], (s) => s.family.knownStores());
}

/** Creates the member (and their calendar); optionally uploads the photo picked in the form. */
export function useCreateChild() {
  const { t } = useTranslation();
  return useDataMutation(
    async (s, v: ChildInput & { photoSource?: UploadSource | null }) => {
      const { photoSource, ...input } = v;
      const created = await s.family.createChild(input);
      if (!photoSource) return created;
      const uploaded = await getStorageProvider('local', s.userId).uploadFile(photoSource, null);
      await s.family.setChildPhoto(created.id, { providerId: 'local', providerFileId: uploaded.providerFileId });
      return { ...created, photo: { providerId: 'local', providerFileId: uploaded.providerFileId } };
    },
    { invalidate: ['family', 'calendars'], successMessage: t('family.toast.childCreated') },
  );
}

export function useSaveActivities() {
  const { t } = useTranslation();
  return useDataMutation((s, v: { memberId: string; activities: ActivityInput[] }) => s.family.saveActivities(v.memberId, v.activities), {
    invalidate: ['family', 'events'],
    successMessage: t('family.activities.saved'),
  });
}

export function useUpdateChild() {
  const { t } = useTranslation();
  return useDataMutation((s, v: { id: string; input: Partial<ChildInput> }) => s.family.updateChild(v.id, v.input), {
    invalidate: ['family', 'calendars'],
    successMessage: t('common.saved'),
  });
}

/** Deletes the profile and its photo (items move to "Casa"). */
export function useRemoveChild() {
  const { t } = useTranslation();
  return useDataMutation(
    async (s, id: string) => {
      const child = await s.family.removeChild(id);
      if (child?.photo) await deletePhoto(s.userId, child.photo);
    },
    { invalidate: ['family', 'calendars'], successMessage: t('family.toast.childRemoved') },
  );
}

// ---------- Photo (device-only, local provider) ----------

async function deletePhoto(userId: string, ref: StoredFileRef) {
  try {
    await getStorageProvider('local', userId).deleteFile(ref);
  } catch {
    // Already gone: nothing to clean up.
  }
}

export function useSetChildPhoto() {
  const { t } = useTranslation();
  return useDataMutation(
    async (s, v: { child: Child; source: UploadSource | null }) => {
      const local = getStorageProvider('local', s.userId);
      const uploaded = v.source ? await local.uploadFile(v.source, null) : null;
      const updated = await s.family.setChildPhoto(
        v.child.id,
        uploaded ? { providerId: 'local', providerFileId: uploaded.providerFileId } : null,
      );
      if (v.child.photo) await deletePhoto(s.userId, v.child.photo);
      return updated;
    },
    { invalidate: ['family'], successMessage: t('family.photo.saved') },
  );
}

/** Resolves a child's stored photo to a displayable URI (cached per file). */
export function useChildPhotoUri(photo: StoredFileRef | null | undefined) {
  const services = useServices();
  const query = useQuery({
    queryKey: ['u', services.userId, 'family', 'photo', photo?.providerFileId ?? null],
    enabled: !!photo,
    staleTime: Infinity,
    queryFn: async () => (await getStorageProvider('local', services.userId).downloadFile(photo!)).uri,
  });
  return photo ? (query.data ?? null) : null;
}

// ---------- Lists ----------

export function useAddFamilyItem() {
  const { t } = useTranslation();
  return useDataMutation((s, v: { list: FamilyListKind } & ItemInput) => s.family.addItem(v.list, v), {
    invalidate: ['family'],
    successMessage: t('family.toast.added'),
  });
}

export function useUpdateFamilyItem() {
  const { t } = useTranslation();
  return useDataMutation((s, v: { id: string; input: Partial<ItemInput> }) => s.family.updateItem(v.id, v.input), {
    invalidate: ['family'],
    successMessage: t('common.saved'),
  });
}

export function useToggleFamilyItem() {
  return useDataMutation((s, item: FamilyItem) => s.family.toggleItem(item), { invalidate: ['family'] });
}

export function useRemoveFamilyItem() {
  return useDataMutation((s, id: string) => s.family.removeItem(id), { invalidate: ['family'] });
}

export function useClearDone() {
  const { t } = useTranslation();
  return useDataMutation((s, list: FamilyListKind) => s.family.clearDone(list), {
    invalidate: ['family'],
    successMessage: (count) => t('family.toast.cleared', { count }),
  });
}

// ---------- Members ----------

export function useMembers() {
  return useDataQuery('family', ['members'], (s) => s.family.listMembers());
}

export function useAddMember() {
  const { t } = useTranslation();
  return useDataMutation((s, input: MemberInput) => s.family.addMember(input), {
    invalidate: ['family'],
    successMessage: t('family.sharing.added'),
    errorMessage: (e) =>
      e instanceof Error && e.message === 'Invalid email' ? t('family.sharing.invalidEmail') : t('common.errorDescription'),
  });
}

export function useUpdateMember() {
  const { t } = useTranslation();
  return useDataMutation((s, v: { id: string; input: Partial<MemberInput> }) => s.family.updateMember(v.id, v.input), {
    invalidate: ['family'],
    successMessage: t('common.saved'),
  });
}

export function useRemoveMember() {
  return useDataMutation((s, id: string) => s.family.removeMember(id), { invalidate: ['family'] });
}
