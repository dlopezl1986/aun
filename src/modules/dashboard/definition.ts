import type { AppModule } from '@/types/module';
import { QuickActionsWidget } from './components/QuickActionsWidget';
import { TodayPanel } from './components/TodayPanel';
import { WeekWidget } from './components/WeekWidget';

export const dashboardModule: AppModule = {
  id: 'dashboard',
  routeName: 'index',
  titleKey: 'modules.dashboard.title',
  descriptionKey: 'modules.dashboard.description',
  icon: 'home',
  accent: '#2563EB',
  kind: 'core',
  defaultEnabled: true,
  nav: { section: 'main', order: 0, mobilePriority: -1 },
  entitlement: null,
  widgets: [
    {
      id: 'dashboard.today',
      moduleId: 'dashboard',
      titleKey: 'dashboard.today',
      descriptionKey: 'dashboard.todayDescription',
      icon: 'sun',
      size: 'full',
      sizes: ['full'],
      defaultVisible: true,
      component: TodayPanel,
    },
    {
      id: 'dashboard.quickActions',
      moduleId: 'dashboard',
      titleKey: 'dashboard.quick.title',
      descriptionKey: 'dashboard.quick.description',
      icon: 'zap',
      size: 'full',
      sizes: ['lg', 'full'],
      defaultVisible: true,
      component: QuickActionsWidget,
    },
    {
      id: 'dashboard.week',
      moduleId: 'dashboard',
      titleKey: 'dashboard.week.title',
      descriptionKey: 'dashboard.week.description',
      icon: 'bar-chart-2',
      size: 'lg',
      sizes: ['md', 'lg', 'full'],
      // Spec example: "☐ Estadísticas" — off by default.
      defaultVisible: false,
      component: WeekWidget,
    },
  ],
};
