import type { RelatedSource } from '@/types/module';
import { shoppingMeta } from './meta';

/** "Compras para Elisa": pending items assigned to a family member. */
export const personShoppingSource: RelatedSource = {
  id: 'shopping.forPerson',
  titleKey: 'related.shopping',
  icon: 'shopping-cart',
  scope: 'shopping',
  async list(services, ref) {
    if (ref.module !== 'family') return [];
    await services.shopping.listLists();
    return (await services.shopping.listItems())
      .filter((i) => !i.done && i.personId === ref.id)
      .map((i) => ({
        ref: { module: shoppingMeta.id, type: 'item', id: i.id },
        title: i.title,
        subtitle: [i.quantity, i.store].filter(Boolean).join(' · ') || undefined,
        route: '/shopping',
      }));
  },
};
