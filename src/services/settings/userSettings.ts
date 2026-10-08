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
  };
  secondBrain: {
    storageProvider: StorageProviderId;
  };
  notifications: NotificationPrefs;
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

  return {
    schemaVersion: 1,
    modules: moduleEntries,
    dashboard: { widgets },
    secondBrain: { storageProvider: raw?.secondBrain?.storageProvider ?? 'local' },
    notifications: { ...defaultNotificationPrefs(), ...(raw?.notifications ?? {}) },
  };
}

export function defaultDashboard(modules: AppModule[]): UserSettings['dashboard'] {
  return {
    widgets: modules.flatMap((m) => (m.widgets ?? []).map((w) => ({ id: w.id, visible: w.defaultVisible }))),
  };
}
