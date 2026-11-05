import type { AppModule } from '@/types/module';
import { documentLinkSource } from './links';
import { secondBrainMeta } from './meta';

export const secondBrainModule: AppModule = {
  id: secondBrainMeta.id,
  routeName: 'second-brain',
  titleKey: 'modules.secondBrain.title',
  descriptionKey: 'modules.secondBrain.description',
  icon: secondBrainMeta.icon,
  accent: secondBrainMeta.accent,
  kind: 'feature',
  defaultEnabled: true,
  nav: { section: 'main', order: 10, mobilePriority: 2 },
  notificationSource: false,
  entitlement: null,
  search: { search: (q, s) => s.secondBrain.search(q.text) },
  linkSources: [documentLinkSource],
  // Files live only in Docs (sidebar / bottom bar): no widget or shortcuts on Inicio.
};
