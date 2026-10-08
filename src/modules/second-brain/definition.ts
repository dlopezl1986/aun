import type { AppModule } from '@/types/module';
import { documentLinkSource } from './links';
import { secondBrainMeta } from './meta';
import { QuickFolderSheet, QuickImportSheet, SecondBrainWidget } from './widgets';

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
  quickActions: [
    { id: 'second-brain.import', labelKey: 'secondBrain.import.action', icon: 'upload', Sheet: QuickImportSheet },
    { id: 'second-brain.newFolder', labelKey: 'secondBrain.newFolder', icon: 'folder-plus', Sheet: QuickFolderSheet },
  ],
  search: { search: (q, s) => s.secondBrain.search(q.text) },
  linkSources: [documentLinkSource],
  widgets: [
    {
      id: 'second-brain.overview',
      moduleId: secondBrainMeta.id,
      titleKey: 'modules.secondBrain.title',
      descriptionKey: 'secondBrain.widget.description',
      icon: secondBrainMeta.icon,
      size: 'md',
      defaultVisible: false,
      component: SecondBrainWidget,
    },
  ],
};
