import { CalendarService } from '@/modules/calendars/service';
import type { Calendar, CalendarEvent, DayNote } from '@/modules/calendars/types';
import { createEmailProviders } from '@/modules/email/providers';
import { EmailService } from '@/modules/email/service';
import type { EmailAccount } from '@/modules/email/types';
import { FamilyService } from '@/modules/family/service';
import type { Child, FamilyItem, FamilyMember } from '@/modules/family/types';
import { NotificationService } from '@/modules/notifications/service';
import type { AppNotification, Reminder } from '@/modules/notifications/types';
import { SecondBrainService } from '@/modules/second-brain/service';
import type { DocumentItem, Folder } from '@/modules/second-brain/types';
import { ShoppingService } from '@/modules/shopping/service';
import type { ShoppingCategory, ShoppingItem, ShoppingList } from '@/modules/shopping/types';
import { TaskService } from '@/modules/todo/service';
import type { Area, Project, Section, Tag, Task } from '@/modules/todo/types';
import { asyncKeyValueStore, type KeyValueStore } from '@/storage/keyValueStore';
import { LocalRepository, type Repository, type SyncableRepository } from '@/storage/repository';
import type { BaseEntity } from '@/types/entity';
import { useUserSettings } from '@/state/userSettingsStore';
import { backend, backendKind } from './backend';
import { memberCalendarBridge } from './bridges/memberCalendarBridge';
import { RelationService, type Relation } from './relations/relationService';
import { StorageService } from './storage/StorageService';
import { SyncEngine } from './sync/engine';
import { SupabaseRemoteStore } from './sync/supabaseRemote';
import type { RemoteStore } from './sync/types';

function defaultRemote(userId: string): RemoteStore | null {
  if (backendKind === 'firebase') {
    // Dynamic so Firestore is not bundled in Supabase/local builds.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { FirebaseRemoteStore } = require('./sync/firebaseRemote') as typeof import('./sync/firebaseRemote');
    return new FirebaseRemoteStore(userId);
  }
  return backend ? new SupabaseRemoteStore(backend) : null;
}

export interface Services {
  userId: string;
  calendars: CalendarService;
  tasks: TaskService;
  secondBrain: SecondBrainService;
  family: FamilyService;
  shopping: ShoppingService;
  email: EmailService;
  notifications: NotificationService;
  relations: RelationService;
  /** Every user-data collection, for the sync engine (Phase 9). */
  collections: Map<string, SyncableRepository>;
  /** Backend sync; `null` in local-only mode. */
  sync: SyncEngine | null;
}

/**
 * Collections synced with the backend. Not synced on purpose: e-mail accounts
 * (their OAuth tokens are per device) and the demo mailbox.
 */
export const SYNCED_COLLECTIONS = [
  'calendars',
  'events',
  'dayNotes',
  'tasks',
  'areas',
  'projects',
  'sections',
  'tags',
  'folders',
  'documents',
  'children',
  'familyItems',
  'familyMembers',
  'shoppingLists',
  'shoppingItems',
  'shoppingCategories',
  'reminders',
  'notifications',
  'relations',
] as const;

/**
 * Composition root: builds every service for a signed-in user.
 * To move to a backend, swap `repo()` for a remote/sync repository factory.
 */
export function createServices(
  userId: string,
  store: KeyValueStore = asyncKeyValueStore,
  remote: RemoteStore | null = defaultRemote(userId),
): Services {
  const collections = new Map<string, SyncableRepository>();
  // One instance per collection: services and the sync engine share the same cache.
  const repo = <T extends BaseEntity>(collection: string): Repository<T> => {
    let r = collections.get(collection);
    if (!r) {
      r = new LocalRepository<BaseEntity>(store, userId, collection);
      collections.set(collection, r);
    }
    return r as unknown as Repository<T>;
  };

  const calendars = new CalendarService(repo<Calendar>('calendars'), repo<CalendarEvent>('events'), repo<DayNote>('dayNotes'));
  const services = {
    userId,
    calendars,
    tasks: new TaskService(
      repo<Task>('tasks'),
      repo<Area>('areas'),
      repo<Project>('projects'),
      repo<Section>('sections'),
      repo<Tag>('tags'),
    ),
    secondBrain: new SecondBrainService(
      repo<Folder>('folders'),
      repo<DocumentItem>('documents'),
      new StorageService(userId, () => useUserSettings.getState().settings?.secondBrain.storageProvider ?? 'local'),
    ),
    family: new FamilyService(
      repo<Child>('children'),
      repo<FamilyItem>('familyItems'),
      repo<FamilyMember>('familyMembers'),
      memberCalendarBridge(calendars),
    ),
    shopping: new ShoppingService(
      repo<ShoppingList>('shoppingLists'),
      repo<ShoppingItem>('shoppingItems'),
      repo<ShoppingCategory>('shoppingCategories'),
      repo<FamilyItem>('familyItems'),
    ),
    email: new EmailService(repo<EmailAccount>('emailAccounts'), userId, createEmailProviders(store, userId)),
    notifications: new NotificationService(repo<AppNotification>('notifications'), repo<Reminder>('reminders')),
    relations: new RelationService(repo<Relation>('relations')),
  };
  const synced = new Map(SYNCED_COLLECTIONS.map((c) => [c, collections.get(c) ?? (repo(c) as unknown as SyncableRepository)]));
  return {
    ...services,
    collections: synced,
    sync: remote ? new SyncEngine(synced, remote, store, userId) : null,
  };
}
