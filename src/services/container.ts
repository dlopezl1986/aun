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
import { useAppPreferences } from '@/state/appPreferences';
import { useUserSettings } from '@/state/userSettingsStore';
import { backend, backendKind } from './backend';
import { memberCalendarBridge } from './bridges/memberCalendarBridge';
import { RelationService, type Relation } from './relations/relationService';
import { StorageService } from './storage/StorageService';
import { SyncEngine } from './sync/engine';
import { SupabaseRemoteStore } from './sync/supabaseRemote';
import type { RemoteStore } from './sync/types';
import type { FirebaseNotifyService } from './remoteNotify/firebaseNotify';
import type { FirebaseSharingService } from './sharing/firebaseSharing';

/** Backend sync + sharing for a user. Sharing between accounts exists on Firebase only. */
function defaultBackend(
  userId: string,
  calendarOwner: (calendarId: string) => Promise<string | null>,
): { remote: RemoteStore | null; sharing: FirebaseSharingService | null; notify: FirebaseNotifyService | null } {
  if (backendKind === 'firebase') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { FirebaseRemoteStore } = require('./sync/firebaseRemote') as typeof import('./sync/firebaseRemote');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { FirebaseSharingService } = require('./sharing/firebaseSharing') as typeof import('./sharing/firebaseSharing');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { FirebaseNotifyService } = require('./remoteNotify/firebaseNotify') as typeof import('./remoteNotify/firebaseNotify');
    const remote = new FirebaseRemoteStore(userId, calendarOwner);
    return {
      remote,
      sharing: new FirebaseSharingService(userId, () => void remote.loadSpaces(true).catch(() => undefined)),
      notify: new FirebaseNotifyService(userId),
    };
  }
  return { remote: backend ? new SupabaseRemoteStore(backend) : null, sharing: null, notify: null };
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
  /** Sharing with other accounts (family, calendars); `null` unless the backend is Firebase. */
  sharing: FirebaseSharingService | null;
  /** E-mail / Telegram notices; `null` unless the backend is Firebase. */
  notify: FirebaseNotifyService | null;
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
  /** `undefined` = the configured backend; `null` = local only (tests). */
  remote?: RemoteStore | null,
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

  const calendars = new CalendarService(repo<Calendar>('calendars'), repo<CalendarEvent>('events'), repo<DayNote>('dayNotes'), userId, {
    isHidden: (id) => useAppPreferences.getState().hiddenSharedCalendars.includes(id),
    setHidden: (id, hidden) => useAppPreferences.getState().setSharedCalendarHidden(id, hidden),
    clear: () => useAppPreferences.getState().clearHiddenSharedCalendars(),
  });
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
  // Events are stored in their calendar's space: the calendar owner comes from local data.
  const calendarOwner = async (calendarId: string) =>
    (await collections.get('calendars')!.listAllRaw()).find((c) => c.id === calendarId)?.ownerId ?? null;
  const backendParts = remote === undefined ? defaultBackend(userId, calendarOwner) : { remote, sharing: null, notify: null };
  return {
    ...services,
    collections: synced,
    sync: backendParts.remote ? new SyncEngine(synced, backendParts.remote, store, userId) : null,
    sharing: backendParts.sharing,
    notify: backendParts.notify,
  };
}
