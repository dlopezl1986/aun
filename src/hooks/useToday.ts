import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { todayKey } from '@/utils/date';

/** Current day key, refreshed when the app returns to foreground or midnight passes. */
export function useToday(): string {
  const [key, setKey] = useState(todayKey());
  useEffect(() => {
    const refresh = () => setKey(todayKey());
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    const interval = setInterval(refresh, 60_000);
    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, []);
  return key;
}
