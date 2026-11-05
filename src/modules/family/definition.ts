import type { AppModule } from '@/types/module';
import { birthdayAlertSource, tomorrowAlertSource } from './alerts';
import { childLinkSource } from './links';
import { familyMeta } from './meta';
import { FamilyTodaySummary, FamilyWeeklyStats, QuickFamilyItemSheet } from './widgets';

export const familyModule: AppModule = {
  id: familyMeta.id,
  routeName: 'family',
  titleKey: 'modules.family.title',
  descriptionKey: 'modules.family.description',
  icon: familyMeta.icon,
  accent: familyMeta.accent,
  kind: 'feature',
  defaultEnabled: true,
  nav: { section: 'main', order: 50, mobilePriority: 3 },
  notificationSource: true,
  alerts: [tomorrowAlertSource, birthdayAlertSource],
  entitlement: null,
  todaySummary: FamilyTodaySummary,
  weeklyStats: FamilyWeeklyStats,
  quickActions: [{ id: 'family.addItem', labelKey: 'family.quick.action', icon: 'briefcase', Sheet: QuickFamilyItemSheet }],
  search: { search: (q, s) => s.family.search(q.text) },
  linkSources: [childLinkSource],
  // No widgets on Inicio (user's decision, 2026-11-05): their «Hoy» tile is enough.
};
