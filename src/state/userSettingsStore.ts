import { useMemo } from 'react';
import { create } from 'zustand';

import {
  defaultDashboard,
  defaultNotificationPrefs,
  normalizeSettings,
  type NotificationPrefs,
  type UserSettings,
} from '@/services/settings/userSettings';
import { asyncKeyValueStore, readJson, storageKeys, writeJson } from '@/storage/keyValueStore';
import type { StorageProviderId } from '@/storage/providers/types';
import type { AppModule, DashboardWidgetDefinition, WidgetSize } from '@/types/module';

type Status = 'idle' | 'loading' | 'ready' | 'error';

interface UserSettingsState {
  userId: string | null;
  /**
   * Module registry, injected by the app shell on load. The store never
   * imports the registry itself: modules' widgets depend on this store, so
   * importing the registry here would create a dependency cycle.
   */
  modules: AppModule[];
  status: Status;
  settings: UserSettings | null;
  load: (userId: string, modules: AppModule[]) => Promise<void>;
  setModuleEnabled: (moduleId: string, enabled: boolean) => Promise<void>;
  setWidgetVisible: (widgetId: string, visible: boolean) => Promise<void>;
  /** `visibleOnly` skips hidden widgets (used when editing on the dashboard). */
  moveWidget: (widgetId: string, direction: -1 | 1, visibleOnly?: boolean) => Promise<void>;
  setWidgetSize: (widgetId: string, size: WidgetSize) => Promise<void>;
  resetDashboard: () => Promise<void>;
  setStorageProvider: (provider: StorageProviderId) => Promise<void>;
  setNotificationPrefs: (patch: Partial<NotificationPrefs>) => Promise<void>;
  clear: () => void;
}

const keyFor = (userId: string) => storageKeys.user(userId, 'settings');

export const useUserSettings = create<UserSettingsState>()((set, get) => {
  async function commit(next: UserSettings) {
    const { userId } = get();
    if (!userId) return;
    set({ settings: next });
    await writeJson(asyncKeyValueStore, keyFor(userId), next);
  }

  function current(): UserSettings {
    const s = get().settings;
    if (!s) throw new Error('User settings not loaded');
    return s;
  }

  return {
    userId: null,
    modules: [],
    status: 'idle',
    settings: null,
    async load(userId, modules) {
      set({ userId, modules, status: 'loading' });
      try {
        const raw = await readJson<Partial<UserSettings> | null>(asyncKeyValueStore, keyFor(userId), null);
        set({ settings: normalizeSettings(raw, modules), status: 'ready' });
      } catch {
        set({ status: 'error' });
      }
    },
    async setModuleEnabled(moduleId, enabled) {
      const s = current();
      const mod = get().modules.find((m) => m.id === moduleId);
      if (mod?.kind === 'core') return;
      await commit({ ...s, modules: { ...s.modules, [moduleId]: { enabled } } });
    },
    async setWidgetVisible(widgetId, visible) {
      const s = current();
      await commit({
        ...s,
        dashboard: { widgets: s.dashboard.widgets.map((w) => (w.id === widgetId ? { ...w, visible } : w)) },
      });
    },
    async moveWidget(widgetId, direction, visibleOnly = false) {
      const s = current();
      const list = s.dashboard.widgets.slice();
      const from = list.findIndex((w) => w.id === widgetId);
      // Move relative to the previous/next widget that is actually displayable.
      const available = new Set(availableWidgetDefinitions(s, get().modules).map((w) => w.id));
      let to = from + direction;
      const skip = (i: number) => !available.has(list[i].id) || (visibleOnly && !list[i].visible);
      while (to >= 0 && to < list.length && skip(to)) to += direction;
      if (from < 0 || to < 0 || to >= list.length) return;
      const [item] = list.splice(from, 1);
      list.splice(to, 0, item);
      await commit({ ...s, dashboard: { widgets: list } });
    },
    async setWidgetSize(widgetId, size) {
      const s = current();
      await commit({
        ...s,
        dashboard: { widgets: s.dashboard.widgets.map((w) => (w.id === widgetId ? { ...w, size } : w)) },
      });
    },
    async resetDashboard() {
      await commit({ ...current(), dashboard: defaultDashboard(get().modules) });
    },
    async setStorageProvider(provider) {
      const s = current();
      await commit({ ...s, secondBrain: { ...s.secondBrain, storageProvider: provider } });
    },
    async setNotificationPrefs(patch) {
      const s = current();
      await commit({ ...s, notifications: { ...s.notifications, ...patch } });
    },
    clear() {
      set({ userId: null, settings: null, status: 'idle' });
    },
  };
});

// ---------- Selectors ----------

function isEnabled(settings: UserSettings | null, mod: AppModule): boolean {
  if (mod.kind === 'core') return true;
  return settings?.modules[mod.id]?.enabled ?? mod.defaultEnabled;
}

/** Widgets whose module is enabled, in user order (visible or not). */
function availableWidgetDefinitions(settings: UserSettings, registry: AppModule[]): DashboardWidgetDefinition[] {
  const byId = new Map<string, DashboardWidgetDefinition>();
  for (const m of registry) {
    if (!isEnabled(settings, m)) continue;
    for (const w of m.widgets ?? []) byId.set(w.id, w);
  }
  return settings.dashboard.widgets.map((p) => byId.get(p.id)).filter((w): w is DashboardWidgetDefinition => !!w);
}

export function useNotificationPrefs(): NotificationPrefs {
  const prefs = useUserSettings((s) => s.settings?.notifications);
  return useMemo(() => prefs ?? defaultNotificationPrefs(), [prefs]);
}

/** All registered modules (enabled or not). */
export function useModules(): AppModule[] {
  return useUserSettings((s) => s.modules);
}

export function useEnabledModules(): AppModule[] {
  const settings = useUserSettings((s) => s.settings);
  const modules = useModules();
  return useMemo(() => modules.filter((m) => isEnabled(settings, m)), [settings, modules]);
}

export function useIsModuleEnabled(moduleId: string): boolean {
  const settings = useUserSettings((s) => s.settings);
  const mod = useModules().find((m) => m.id === moduleId);
  return mod ? isEnabled(settings, mod) : false;
}

export interface DashboardWidgetState {
  definition: DashboardWidgetDefinition;
  visible: boolean;
  size: WidgetSize;
}

export function useDashboardWidgets(): DashboardWidgetState[] {
  const settings = useUserSettings((s) => s.settings);
  const modules = useModules();
  return useMemo(() => {
    if (!settings) return [];
    const prefs = new Map(settings.dashboard.widgets.map((w) => [w.id, w]));
    return availableWidgetDefinitions(settings, modules).map((definition) => {
      const pref = prefs.get(definition.id);
      const allowed = definition.sizes ?? ['md', 'lg', 'full'];
      const size = pref?.size && allowed.includes(pref.size) ? pref.size : definition.size;
      return { definition, visible: pref?.visible ?? definition.defaultVisible, size };
    });
  }, [settings, modules]);
}
