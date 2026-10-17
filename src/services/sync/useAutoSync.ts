import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { create } from 'zustand';

import { useServices } from '@/services/ServicesProvider';
import { SyncError, type SyncResult } from './types';

interface SyncStatus {
  running: boolean;
  last: SyncResult | null;
  error: SyncError['code'] | 'unknown' | null;
  set: (patch: Partial<Omit<SyncStatus, 'set'>>) => void;
}

/** Live sync status for the UI (settings screen, indicators). */
export const useSyncStatus = create<SyncStatus>()((set) => ({
  running: false,
  last: null,
  error: null,
  set: (patch) => set(patch),
}));

/** Safety net; live listeners and change-triggered syncs do the real work. */
const PERIOD_MS = 10 * 60_000;
/** Upload this long after the last local change (groups quick edits in one write). */
const AFTER_CHANGE_MS = 1_000;
/** Group live updates that arrive together before refreshing the screens. */
const REFRESH_MS = 150;

/** Runs a sync and refreshes every screen when something came from the server. */
export function useSyncNow() {
  const services = useServices();
  const client = useQueryClient();
  return useCallback(
    async (opts: { full?: boolean } = {}) => {
      if (!services.sync) return null;
      const status = useSyncStatus.getState();
      status.set({ running: true });
      try {
        const result = await services.sync.sync(opts);
        status.set({ running: false, last: result, error: null });
        if (result.pulled > 0) await client.invalidateQueries({ queryKey: ['u', services.userId] });
        return result;
      } catch (e) {
        status.set({ running: false, error: e instanceof SyncError ? e.code : 'unknown' });
        return null;
      }
    },
    [services, client],
  );
}

/**
 * Keeps the device and the backend in sync. No-op in local-only mode.
 *  - Up: about a second after any change made on this device (any module).
 *  - Down: live listeners merge what other devices / the family change, in
 *    seconds; a change in what is shared with me runs a full sync.
 *  - Safety net: on start, when coming back to the app or online, and every
 *    10 minutes.
 */
export function useAutoSync() {
  const services = useServices();
  const client = useQueryClient();
  const syncNow = useSyncNow();
  useEffect(() => {
    if (!services.sync) return;
    let upload: ReturnType<typeof setTimeout> | null = null;
    let refresh: ReturnType<typeof setTimeout> | null = null;
    void syncNow();
    const interval = setInterval(() => void syncNow(), PERIOD_MS);
    const app = AppState.addEventListener('change', (s) => s === 'active' && void syncNow());
    const onOnline = () => void syncNow();
    const win = typeof window !== 'undefined' && typeof window.addEventListener === 'function' ? window : null;
    win?.addEventListener('online', onOnline);
    const offChange = services.onLocalChange(() => {
      if (upload) clearTimeout(upload);
      upload = setTimeout(() => void syncNow(), AFTER_CHANGE_MS);
    });
    const stopWatch = services.sync.watch({
      onChanged: () => {
        if (refresh) clearTimeout(refresh);
        refresh = setTimeout(() => void client.invalidateQueries({ queryKey: ['u', services.userId] }), REFRESH_MS);
      },
      onAccess: () => void syncNow(),
    });
    return () => {
      clearInterval(interval);
      app.remove();
      win?.removeEventListener('online', onOnline);
      offChange();
      stopWatch();
      if (upload) clearTimeout(upload);
      if (refresh) clearTimeout(refresh);
    };
  }, [services, syncNow, client]);
}
