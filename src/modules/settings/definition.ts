import type { AppModule } from '@/types/module';

export const settingsModule: AppModule = {
  id: 'settings',
  routeName: 'settings',
  titleKey: 'modules.settings.title',
  descriptionKey: 'modules.settings.description',
  icon: 'settings',
  accent: '#64748B',
  kind: 'core',
  defaultEnabled: true,
  nav: { section: 'system', order: 100 },
  entitlement: null,
};
