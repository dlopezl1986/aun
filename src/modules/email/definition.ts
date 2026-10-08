import type { AppModule } from '@/types/module';
import { emailMeta } from './meta';
import { EmailTodaySummary, EmailWidget } from './widgets';

export const emailModule: AppModule = {
  id: emailMeta.id,
  routeName: 'email',
  titleKey: 'modules.email.title',
  descriptionKey: 'modules.email.description',
  icon: emailMeta.icon,
  accent: emailMeta.accent,
  kind: 'feature',
  defaultEnabled: true,
  nav: { section: 'main', order: 40, mobilePriority: 4 },
  notificationSource: true,
  entitlement: null,
  todaySummary: EmailTodaySummary,
  widgets: [
    {
      id: 'email.inbox',
      moduleId: emailMeta.id,
      titleKey: 'email.widget.title',
      descriptionKey: 'email.widget.description',
      icon: 'mail',
      size: 'md',
      defaultVisible: true,
      component: EmailWidget,
    },
  ],
};
