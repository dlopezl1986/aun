import type { BottomTabBarProps } from 'expo-router/js-tabs';

import { useBreakpoint } from '@/hooks/useBreakpoint';
import { BottomBar } from './BottomBar';
import { Sidebar } from './Sidebar';

/**
 * Custom tab bar for the authenticated area: a sidebar on tablet/desktop
 * and a bottom bar on phones. Both are driven by the module registry.
 */
export function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const { hasSidebar } = useBreakpoint();
  const activeRoute = state.routes[state.index]?.name ?? 'index';
  const onNavigate = (routeName: string) => {
    const route = state.routes.find((r) => r.name === routeName);
    if (!route) return;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!event.defaultPrevented) navigation.navigate(routeName);
  };
  return hasSidebar ? (
    <Sidebar activeRoute={activeRoute} onNavigate={onNavigate} />
  ) : (
    <BottomBar activeRoute={activeRoute} onNavigate={onNavigate} />
  );
}
