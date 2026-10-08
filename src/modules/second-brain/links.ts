import type { LinkSource } from '@/types/module';
import { secondBrainMeta } from './meta';

/** 2ndBrain documents can be attached to events, tasks… (section 48). */
export const documentLinkSource: LinkSource = {
  type: 'document',
  labelKey: 'links.sources.documents',
  icon: 'file-text',
  async list(services, query) {
    return (await services.secondBrain.linkableDocuments(query)).map(({ doc, folderName }) => ({
      ref: { module: secondBrainMeta.id, type: 'document', id: doc.id },
      title: doc.name,
      subtitle: folderName,
      route: `/second-brain/document/${doc.id}`,
    }));
  },
  async resolve(services, ids) {
    return (await services.secondBrain.linkableDocuments('', ids)).map(({ doc, folderName }) => ({
      ref: { module: secondBrainMeta.id, type: 'document', id: doc.id },
      title: doc.name,
      subtitle: folderName,
      route: `/second-brain/document/${doc.id}`,
    }));
  },
};
