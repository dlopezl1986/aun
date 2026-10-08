import type { Services } from '@/services/container';
import type { AlertContext, AlertItem, AppModule } from '@/types/module';
import type { NotificationPrefs } from '@/services/settings/userSettings';

/** Alert sources of enabled modules, minus the ones the user switched off. */
export function activeAlertSources(modules: AppModule[], prefs: Pick<NotificationPrefs, 'sources'>) {
  return modules.flatMap((module) =>
    (module.alerts ?? []).filter((s) => prefs.sources[s.id] !== false).map((source) => ({ module, source })),
  );
}

/**
 * Collects every alert in [from, to] from the given modules. A failing source
 * never breaks the others. Sorted by time, de-duplicated by key.
 */
export async function collectAlerts(
  services: Services,
  modules: AppModule[],
  prefs: Pick<NotificationPrefs, 'sources'>,
  ctx: AlertContext,
): Promise<AlertItem[]> {
  const lists = await Promise.all(
    activeAlertSources(modules, prefs).map(async ({ source }) => {
      try {
        return await source.list(services, ctx);
      } catch {
        return [];
      }
    }),
  );
  const byKey = new Map<string, AlertItem>();
  for (const a of lists.flat()) byKey.set(a.key, a);
  return [...byKey.values()].sort((a, b) => a.at.localeCompare(b.at));
}
