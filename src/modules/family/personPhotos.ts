import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { useToast } from '@/components/feedback/ToastProvider';
import { useServices } from '@/services/ServicesProvider';
import { storageKeys } from '@/storage/keyValueStore';
import { getStorageProvider } from '@/storage/providers/factory';
import type { StoredFileRef, UploadSource } from '@/storage/providers/types';

/**
 * Photos of the adults shown in Inicio (me, the partner…), who have no
 * Familia profile. Like children's photos they stay ONLY on this device
 * (local provider). Keyed by `${userId}:${personKey}`.
 */
interface PersonPhotosState {
  photos: Record<string, StoredFileRef>;
  set: (key: string, ref: StoredFileRef | null) => void;
}

const usePersonPhotosStore = create<PersonPhotosState>()(
  persist(
    (set) => ({
      photos: {},
      set: (key, ref) =>
        set((s) => {
          const photos = { ...s.photos };
          if (ref) photos[key] = ref;
          else delete photos[key];
          return { photos };
        }),
    }),
    { name: storageKeys.device('person-photos'), storage: createJSONStorage(() => AsyncStorage), version: 1 },
  ),
);

/** Displayable URI of a person's photo (null = initials). */
export function usePersonPhotoUri(personKey: string): string | null {
  const { userId } = useServices();
  const ref = usePersonPhotosStore((s) => s.photos[`${userId}:${personKey}`]);
  const query = useQuery({
    queryKey: ['u', userId, 'family', 'photo', ref?.providerFileId ?? null],
    enabled: !!ref,
    staleTime: Infinity,
    queryFn: async () => (await getStorageProvider('local', userId).downloadFile(ref!)).uri,
  });
  return ref ? (query.data ?? null) : null;
}

export function useHasPersonPhoto(personKey: string): boolean {
  const { userId } = useServices();
  return usePersonPhotosStore((s) => !!s.photos[`${userId}:${personKey}`]);
}

/** Saves (source) or removes (null) a person's photo. */
export function useSetPersonPhoto() {
  const { t } = useTranslation();
  const toast = useToast();
  const { userId } = useServices();
  return async (personKey: string, source: UploadSource | null) => {
    const key = `${userId}:${personKey}`;
    const local = getStorageProvider('local', userId);
    const previous = usePersonPhotosStore.getState().photos[key];
    try {
      const uploaded = source ? await local.uploadFile(source, null) : null;
      usePersonPhotosStore.getState().set(key, uploaded ? { providerId: 'local', providerFileId: uploaded.providerFileId } : null);
      if (previous) await local.deleteFile(previous).catch(() => undefined);
      toast.show(t('family.photo.saved'));
    } catch {
      toast.show(t('common.errorDescription'), 'error');
    }
  };
}
