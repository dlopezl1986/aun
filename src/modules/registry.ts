import type { AppModule } from '@/types/module';
import { calendarsModule } from './calendars/definition';
import { dashboardModule } from './dashboard/definition';
import { emailModule } from './email/definition';
import { familyModule } from './family/definition';
import { notificationsModule } from './notifications/definition';
import { secondBrainModule } from './second-brain/definition';
import { settingsModule } from './settings/definition';
import { shoppingModule } from './shopping/definition';
import { todoModule } from './todo/definition';

/**
 * THE list of AUN modules. Adding a module (e.g. "Finanzas") =
 *   1. create `src/modules/finance/` with a `definition.ts`,
 *   2. add a route folder `src/app/(app)/finance/` (+ ModuleGate layout),
 *   3. register it here and declare its tab in `src/app/(app)/_layout.tsx`.
 * Navigation, dashboard, settings and notifications pick it up automatically.
 */
const modules: AppModule[] = [
  dashboardModule,
  secondBrainModule,
  calendarsModule,
  todoModule,
  emailModule,
  familyModule,
  shoppingModule,
  notificationsModule,
  settingsModule,
];

export function getModuleRegistry(): AppModule[] {
  return modules;
}

export function getModule(id: string): AppModule | undefined {
  return modules.find((m) => m.id === id);
}
