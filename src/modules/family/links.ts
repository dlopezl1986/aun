import type { LinkSource } from '@/types/module';
import { matchScore } from '@/types/search';
import { familyMeta } from './meta';

/** Children can be related to events, tasks, documents… (section 34/48). */
export const childLinkSource: LinkSource = {
  type: 'child',
  labelKey: 'links.sources.children',
  icon: 'smile',
  async list(services, query) {
    const children = await services.family.listChildren();
    return children
      .filter((c) => !query || matchScore(c.name, query) > 0)
      .map((c) => ({
        ref: { module: familyMeta.id, type: 'child', id: c.id },
        title: c.name,
        color: c.color,
        route: `/family/child/${c.id}`,
      }));
  },
  async resolve(services, ids) {
    const children = await services.family.listChildren();
    return children
      .filter((c) => ids.includes(c.id))
      .map((c) => ({
        ref: { module: familyMeta.id, type: 'child', id: c.id },
        title: c.name,
        color: c.color,
        route: `/family/child/${c.id}`,
      }));
  },
};
