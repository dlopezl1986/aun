import type { ComponentType } from 'react';

import type { IconName } from '@/components/ui/Icon';
import type { Services } from '@/services/container';
import type { DataScope } from '@/state/queryClient';
import type { AIContextSource } from './ai';
import type { EntityRef } from './entity';
import type { SearchSource } from './search';

/** Built-in module ids. Kept as a string type so new modules need no core change. */
export type ModuleId = string;

export type WidgetSize = 'md' | 'lg' | 'full';

export interface DashboardWidgetDefinition {
  id: string;
  moduleId: ModuleId;
  titleKey: string;
  descriptionKey: string;
  icon: IconName;
  /** Default size. md = 1 column, lg = 2 columns, full = whole row. */
  size: WidgetSize;
  /** Sizes the user may choose (defaults to all). */
  sizes?: WidgetSize[];
  defaultVisible: boolean;
  component: ComponentType;
}

/** Something another module can link to (a document, a child…) — section 48. */
export interface LinkItem {
  ref: EntityRef;
  title: string;
  subtitle?: string;
  color?: string;
  /** Href to open the linked entity. */
  route?: string;
}

/**
 * Lets a module expose its entities as link targets for other modules
 * (e.g. an event attaches 2ndBrain documents and relates to Familia children)
 * without those modules importing each other.
 */
export interface LinkSource {
  /** Same as EntityRef.type of the items it returns. */
  type: string;
  labelKey: string;
  icon: IconName;
  list(services: Services, query: string): Promise<LinkItem[]>;
  resolve(services: Services, ids: string[]): Promise<LinkItem[]>;
}

/** An entity of this module that points at another entity (e.g. events linked to a child). */
export interface RelatedItem extends LinkItem {
  /** ISO date-time (events) or date key (tasks) used for sorting and display. */
  date?: string;
  allDay?: boolean;
}

/** Extra hints from the profile page, e.g. a family member's own calendar. */
export interface RelatedContext {
  calendarId?: string | null;
}

/**
 * "What is related to X?" — lets a profile page (a child, later a document…)
 * show events, tasks… that link to it, without importing those modules
 * (section 48: relations instead of duplicated data).
 */
export interface RelatedSource {
  id: string;
  titleKey: string;
  icon: IconName;
  /** Query scope, so the list refreshes when this module's data changes. */
  scope: DataScope;
  list(services: Services, ref: EntityRef, today: string, context?: RelatedContext): Promise<RelatedItem[]>;
  /** Creates a new entity already linked to `link`. */
  Create?: ComponentType<{ visible: boolean; onClose: () => void; link: EntityRef; context?: RelatedContext }>;
  createLabelKey?: string;
}

/** Something that should alert the user at a given moment (section 38). */
export interface AlertItem {
  /** Stable id (used to de-duplicate and to schedule/cancel OS notifications). */
  key: string;
  moduleId: string;
  sourceId: string;
  title: string;
  body?: string;
  /** ISO date-time at which to alert. */
  at: string;
  route?: string;
  icon?: IconName;
  color?: string;
}

export interface AlertContext {
  from: Date;
  to: Date;
  t: (key: string, options?: Record<string, unknown>) => string;
  locale: string;
  /** "Para mañana" evening reminder time (HH:MM). */
  tomorrowTime: string;
}

/**
 * A module's notification source: calendar reminders, task reminders,
 * "para mañana"… The notification centre and the OS scheduler only see
 * sources of ENABLED modules, so a disabled module never notifies.
 */
export interface AlertSource {
  id: string;
  labelKey: string;
  descriptionKey: string;
  icon: IconName;
  list(services: Services, ctx: AlertContext): Promise<AlertItem[]>;
}

/** A "create something" shortcut a module offers to the dashboard. */
export interface QuickAction {
  id: string;
  labelKey: string;
  icon: IconName;
  /** Self-contained form shown in a sheet. */
  Sheet: ComponentType<{ visible: boolean; onClose: () => void }>;
}

export interface AppModule {
  id: ModuleId;
  /** Route segment under `src/app/(app)/` (also the tab route name). */
  routeName: string;
  titleKey: string;
  /** Optional shorter label for the mobile bottom bar. */
  shortTitleKey?: string;
  descriptionKey: string;
  icon: IconName;
  /** Brand colour used for icons, chips and widget accents. */
  accent: string;
  /** Core modules (Inicio, Ajustes…) cannot be disabled. */
  kind: 'core' | 'feature';
  defaultEnabled: boolean;
  nav: {
    section: 'main' | 'system';
    order: number;
    /** Priority for the mobile bottom bar (lower = earlier). */
    mobilePriority?: number;
  };
  /** Contributes a line to the dashboard “HOY” panel. */
  todaySummary?: ComponentType;
  widgets?: DashboardWidgetDefinition[];
  /** Contributes stat tiles to the "Tu semana" widget. */
  weeklyStats?: ComponentType;
  /** Shortcuts shown in the dashboard "Acciones rápidas" widget. */
  quickActions?: QuickAction[];
  /** Whether this module emits notifications (filtered when disabled). */
  notificationSource?: boolean;
  /** What this module wants to alert about, and when. */
  alerts?: AlertSource[];
  /** Future: entitlement required (premium plans). `null` = free. */
  entitlement?: string | null;
  /** Entities other modules can link to. */
  linkSources?: LinkSource[];
  /** Entities of this module that link to someone else's entity. */
  related?: RelatedSource[];
  /** Global search provider (Inicio search box). */
  search?: SearchSource;
  /** Future: context provider for the AI assistant. */
  ai?: AIContextSource;
}
