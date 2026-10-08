import { useMemo } from 'react';

import { useNotificationBadge } from '@/modules/notifications/hooks';
import { useEnabledModules } from '@/state/userSettingsStore';
import type { AppModule } from '@/types/module';

export interface NavItem {
  module: AppModule;
  badge?: number;
}

/** Dynamic navigation model derived from enabled modules (section 6). */
export function useNavItems() {
  const modules = useEnabledModules();
  const badge = useNotificationBadge();
  return useMemo(() => {
    const sorted = modules.slice().sort((a, b) => a.nav.order - b.nav.order);
    const withBadge = (m: AppModule): NavItem => ({ module: m, badge: m.id === 'notifications' ? badge : undefined });
    const main = sorted.filter((m) => m.nav.section === 'main').map(withBadge);
    const system = sorted.filter((m) => m.nav.section === 'system').map(withBadge);

    // Mobile: Home + top 3 feature modules in the bar, the rest under "More".
    const byPriority = main.slice().sort((a, b) => (a.module.nav.mobilePriority ?? 99) - (b.module.nav.mobilePriority ?? 99));
    const mobileBar = byPriority.slice(0, 4);
    const mobileMore = [...byPriority.slice(4), ...system];
    return { main, system, mobileBar, mobileMore, notificationBadge: badge };
  }, [modules, badge]);
}
