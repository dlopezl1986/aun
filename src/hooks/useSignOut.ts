import { useCallback } from 'react';

import { useAuthStore } from '@/state/authStore';
import { queryClient } from '@/state/queryClient';
import { useUserSettings } from '@/state/userSettingsStore';

/** Signs out and wipes in-memory user data (persisted data stays on device). */
export function useSignOut() {
  return useCallback(async () => {
    await useAuthStore.getState().signOut();
    queryClient.clear();
    useUserSettings.getState().clear();
  }, []);
}
