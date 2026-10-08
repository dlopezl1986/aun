import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
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

const PERIOD_MS = 5 * 60_000;
const AFTER_CHANGE_MS = 3_000;

/** Runs a sync and refreshes every screen when something came from the server. */
export function useSyncNow() {
  const services = useServices();
  const client = useQueryClient();
  return useCallback(async () => {
    if (!services.sync) return null;
    const status = useSyncStatus.getState();
    status.set({ running: true });
    try {
      const result = await services.sync.sync();
      status.set({ running: false, last: result, error: null });
      if (result.pulled > 0) await client.invalidateQueries({ queryKey: ['u', services.userId] });
      return result;
    } catch (e) {
      status.set({ running: false, error: e instanceof SyncError ? e.code : 'unknown' });
      return null;
    }
  }, [services, client]);
}

/**
 * Keeps the device and the backend in sync: on start, when returning to the
 * app, every 5 minutes and a few seconds after any local change. No-op in
 * local-only mode.
 */
export function useAutoSync() {
  const services = useServices();
  const client = useQueryClient();
  const syncNow = useSyncNow();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enabled = !!services.sync;

  useEffect(() => {
    if (!enabled) return;
    void syncNow();
    const interval = setInterval(() => void syncNow(), PERIOD_MS);
    const app = AppState.addEventListener('change', (s) => s === 'active' && void syncNow());
    const unsubscribe = client.getMutationCache().subscribe((event) => {
      if (event.type !== 'updated' || event.mutation.state.status !== 'success') return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void syncNow(), AFTER_CHANGE_MS);
    });
    return () => {
      clearInterval(interval);
      app.remove();
      unsubscribe();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [enabled, syncNow, client]);
}
