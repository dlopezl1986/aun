import type { AppModule } from '@/types/module';
import { opMeta } from './meta';

export const opModule: AppModule = {
  id: opMeta.id,
  routeName: 'op',
  titleKey: 'modules.op.title',
  descriptionKey: 'modules.op.description',
  icon: opMeta.icon,
  accent: opMeta.accent,
  kind: 'feature',
  defaultEnabled: true,
  nav: { section: 'main', order: 35, mobilePriority: 1.5 },
  entitlement: null,
};
