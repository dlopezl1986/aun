import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { useToast } from '@/components/feedback/ToastProvider';
import { useServices } from '@/services/ServicesProvider';
import { useDataQuery } from '@/state/queryClient';
import { storageKeys } from '@/storage/keyValueStore';
import { getStorageProvider } from '@/storage/providers/factory';
import type { StoredFileRef, UploadSource } from '@/storage/providers/types';
import { makeThumbnail } from './photo';
import type { Child } from './types';

/** Key of a person's photo: an account (`user:<uid>`), a «Compartir familia» person or a Familia profile. */
export const photoKey = {
  user: (uid: string) => `user:${uid}`,
  member: (id: string) => `member:${id}`,
  child: (id: string) => `child:${id}`,
};

/** All synced family photos (personKey → image data URI). */
export function usePersonPhotos(): Record<string, string> {
  return useDataQuery('family', ['personPhotos'], (s) => s.personPhotos.map()).data ?? {};
}

export function usePersonPhoto(personKey: string | null | undefined): string | null {
  const photos = usePersonPhotos();
  return personKey ? (photos[personKey] ?? null) : null;
}

/** Saves (source) or removes (null) a person's photo, for every device of the family. */
export function useSetPersonPhoto() {
  const { t } = useTranslation();
  const toast = useToast();
  const services = useServices();
  const client = useQueryClient();
  return async (personKey: string, source: UploadSource | null) => {
    try {
      await services.personPhotos.set(personKey, source ? await makeThumbnail(source.uri) : null);
      await client.invalidateQueries({ queryKey: ['u', services.userId, 'family'] });
      toast.show(t('family.photo.saved'));
    } catch {
      toast.show(t('common.errorDescription'), 'error');
    }
  };
}

// ---------- Photos saved before they were synced (device-only) ----------

/** Old device-only photos of adults (keys `${userId}:me`, `${userId}:space:<uid>`, `${userId}:member:<id>`). */
const useLegacyPhotos = create<{ photos: Record<string, StoredFileRef> }>()(
  persist(() => ({ photos: {} as Record<string, StoredFileRef> }), {
    name: storageKeys.device('person-photos'),
    storage: createJSONStorage(() => AsyncStorage),
    version: 1,
  }),
);

function legacyToKey(userId: string, key: string): string | null {
  if (!key.startsWith(`${userId}:`)) return null;
  const rest = key.slice(userId.length + 1);
  if (rest === 'me') return photoKey.user(userId);
  if (rest.startsWith('space:')) return photoKey.user(rest.slice(6));
  if (rest.startsWith('member:')) return rest;
  return null;
}

/**
 * Photos picked on this device before photos were synced (adults' and Familia
 * profiles'): uploaded once, so they show up on the other devices too.
 */
export function useUploadDevicePhotos(children: Child[], ready: boolean) {
  const services = useServices();
  const client = useQueryClient();
  const done = useRef(false);
  const synced = useDataQuery('family', ['personPhotos'], (s) => s.personPhotos.map());
  useEffect(() => {
    if (done.current || !ready || !synced.data) return;
    done.current = true;
    const have = synced.data;
    const local = getStorageProvider('local', services.userId);
    const pending: { key: string; ref: StoredFileRef }[] = [];
    for (const c of children) if (c.photo && !have[photoKey.child(c.id)]) pending.push({ key: photoKey.child(c.id), ref: c.photo });
    for (const [legacy, ref] of Object.entries(useLegacyPhotos.getState().photos)) {
      const key = legacyToKey(services.userId, legacy);
      if (key && !have[key]) pending.push({ key, ref });
    }
    if (!pending.length) return;
    void (async () => {
      let changed = false;
      for (const p of pending) {
        try {
          const { uri } = await local.downloadFile(p.ref);
          await services.personPhotos.set(p.key, await makeThumbnail(uri));
          changed = true;
        } catch {
          // The file is gone from this device: nothing to upload.
        }
      }
      if (changed) await client.invalidateQueries({ queryKey: ['u', services.userId, 'family'] });
    })();
  }, [ready, synced.data, children, services, client]);
}
