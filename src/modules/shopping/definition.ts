import type { AppModule } from '@/types/module';
import { personShoppingSource } from './links';
import { shoppingMeta } from './meta';
import { QuickShoppingSheet, ShoppingTodaySummary, ShoppingWeeklyStats, ShoppingWidget } from './widgets';

export const shoppingModule: AppModule = {
  id: shoppingMeta.id,
  routeName: 'shopping',
  titleKey: 'modules.shopping.title',
  descriptionKey: 'modules.shopping.description',
  icon: shoppingMeta.icon,
  accent: shoppingMeta.accent,
  kind: 'feature',
  defaultEnabled: true,
  nav: { section: 'main', order: 55, mobilePriority: 6 },
  notificationSource: false,
  entitlement: null,
  todaySummary: ShoppingTodaySummary,
  weeklyStats: ShoppingWeeklyStats,
  quickActions: [{ id: 'shopping.add', labelKey: 'shopping.quick.action', icon: 'shopping-cart', Sheet: QuickShoppingSheet }],
  search: { search: (q, s) => s.shopping.search(q.text) },
  related: [personShoppingSource],
  widgets: [
    {
      id: 'shopping.list',
      moduleId: shoppingMeta.id,
      titleKey: 'shopping.widget.title',
      descriptionKey: 'shopping.widget.description',
      icon: 'shopping-cart',
      size: 'md',
      defaultVisible: true,
      component: ShoppingWidget,
    },
  ],
};
