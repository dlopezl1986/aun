import type { StorageProviderId } from '@/storage/providers/types';
import type { AppModule, WidgetSize } from '@/types/module';

export interface WidgetPreference {
  id: string;
  visible: boolean;
  /** User-chosen size; falls back to the widget default. */
  size?: WidgetSize;
}

/**
 * Per-user settings. Persisted per account (and synced in Phase 9).
 * Disabling a module only flips `enabled`: its data is never touched.
 */
export interface UserSettings {
  schemaVersion: 1;
  modules: Record<string, { enabled: boolean }>;
  dashboard: {
    /** Ordered list. Order = display order. */
    widgets: WidgetPreference[];
    /** Modules whose tile is hidden in the "Hoy" panel (e.g. 'email'). */
    todayHidden: string[];
    /** Default-layout revision already applied to `widgets` (missing = 1). */
    layoutVersion?: number;
  };
  secondBrain: {
    storageProvider: StorageProviderId;
  };
  notifications: NotificationPrefs;
  calendars: CalendarPrefs;
}

export interface CalendarPrefs {
  /** Show the public holidays (Spain + Comunidad de Madrid). */
  holidays: boolean;
}

export interface NotificationPrefs {
  /** System (OS/browser) notifications on this device. */
  system: boolean;
  /** Per alert source on/off (missing = on). */
  sources: Record<string, boolean>;
  /** "Para mañana" evening reminder (HH:MM). */
  tomorrowTime: string;
  /** Alerts before this moment count as seen (badge). */
  lastSeenAt: string | null;
}

export const defaultNotificationPrefs = (): NotificationPrefs => ({ system: false, sources: {}, tomorrowTime: '20:00', lastSeenAt: null });

/**
 * Merges stored settings with the module registry so that new modules or
 * widgets added in future releases appear automatically with their defaults,
 * while unknown entries (e.g. from a newer client) are preserved.
 */
export function normalizeSettings(raw: Partial<UserSettings> | null, modules: AppModule[]): UserSettings {
  const storedModules = raw?.modules ?? {};
  const moduleEntries: UserSettings['modules'] = { ...storedModules };
  for (const m of modules) {
    if (!moduleEntries[m.id]) moduleEntries[m.id] = { enabled: m.defaultEnabled };
    if (m.kind === 'core') moduleEntries[m.id] = { enabled: true };
  }

  const stored = raw?.dashboard?.widgets ?? [];
  const known = new Set(stored.map((w) => w.id));
  const widgets = [...stored];
  for (const m of modules) {
    for (const w of m.widgets ?? []) {
      if (!known.has(w.id)) widgets.push({ id: w.id, visible: w.defaultVisible });
    }
  }

  // Layout v2: «Tus calendarios» first, «Hoy» after the quick actions. Applied once.
  const layoutVersion = raw?.dashboard?.layoutVersion ?? 1;
  const ordered = layoutVersion < DASHBOARD_LAYOUT_VERSION ? applyLayoutV2(widgets) : widgets;

  return {
    schemaVersion: 1,
    modules: moduleEntries,
    dashboard: { widgets: ordered, todayHidden: raw?.dashboard?.todayHidden ?? [], layoutVersion: DASHBOARD_LAYOUT_VERSION },
    secondBrain: { storageProvider: raw?.secondBrain?.storageProvider ?? 'local' },
    notifications: { ...defaultNotificationPrefs(), ...(raw?.notifications ?? {}) },
    calendars: { holidays: true, ...(raw?.calendars ?? {}) },
  };
}

export const DASHBOARD_LAYOUT_VERSION = 2;

/** Moves one widget so it sits right after `afterId` (or first when `afterId` is null). */
function placeWidget(list: WidgetPreference[], id: string, afterId: string | null): WidgetPreference[] {
  const item = list.find((w) => w.id === id);
  if (!item) return list;
  const rest = list.filter((w) => w.id !== id);
  const at = afterId === null ? 0 : rest.findIndex((w) => w.id === afterId) + 1;
  if (afterId !== null && at === 0) return list;
  return [...rest.slice(0, at), item, ...rest.slice(at)];
}

/** Inicio order: all calendars → quick actions → Hoy → everything else as it was. */
export function applyLayoutV2(widgets: WidgetPreference[]): WidgetPreference[] {
  return placeWidget(placeWidget(widgets, 'calendars.overview', null), 'dashboard.today', 'dashboard.quickActions');
}

export function defaultDashboard(modules: AppModule[]): UserSettings['dashboard'] {
  return {
    widgets: applyLayoutV2(modules.flatMap((m) => (m.widgets ?? []).map((w) => ({ id: w.id, visible: w.defaultVisible })))),
    todayHidden: [],
    layoutVersion: DASHBOARD_LAYOUT_VERSION,
  };
}
