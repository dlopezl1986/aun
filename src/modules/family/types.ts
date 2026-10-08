import type { BaseEntity } from '@/types/entity';
import type { StoredFileRef } from '@/storage/providers/types';
import type { DateKey } from '@/utils/date';

export type MemberRelation = 'child' | 'partner' | 'parent' | 'grandparent' | 'sibling' | 'other';

/** A recurring activity ("Fútbol, martes y jueves 17:30–18:30, Polideportivo"). */
export interface MemberActivity {
  id: string;
  name: string;
  /** Monday = 0 … Sunday = 6. Empty = no fixed schedule (no calendar event). */
  weekdays: number[];
  startTime?: string | null;
  endTime?: string | null;
  place?: string | null;
  notes?: string | null;
  /** Weekly event created in the member's calendar. */
  eventId?: string | null;
}

/** "Ropa: 6 años", "Calzado: 31". `key` is a preset id or a custom label. */
export interface MemberSize {
  key: string;
  value: string;
}

export interface MemberHealth {
  allergies?: string | null;
  bloodType?: string | null;
  doctor?: string | null;
  medication?: string | null;
  notes?: string | null;
}

/** Free "más especificaciones": any label/value the user wants to keep. */
export interface MemberField {
  label: string;
  value: string;
}

/**
 * A family member profile (historically only children, hence the name and
 * the "children" collection). Each member gets a calendar in Calendarios.
 */
export interface Child extends BaseEntity {
  name: string;
  /** Missing on old profiles = 'child'. */
  relation?: MemberRelation;
  birthDate?: DateKey | null;
  color: string;
  /**
   * Profile photo, stored ONLY on this device (local provider) — children's
   * photos never go to a cloud provider unless a future option says so.
   */
  photo?: StoredFileRef | null;
  /** @deprecated Phase 1 field, never written. */
  photoUri?: string | null;
  phone?: string | null;
  email?: string | null;
  school?: string | null;
  /** Course / class, e.g. "2º B". */
  schoolClass?: string | null;
  /** Adults: job / company. */
  occupation?: string | null;
  /** Old profiles stored plain names (string[]); read through `normalizeMember`. */
  activities: (MemberActivity | string)[];
  sizes?: MemberSize[];
  health?: MemberHealth | null;
  extraFields?: MemberField[];
  importantInfo?: string | null;
  notes?: string | null;
  /** The member's own calendar in Calendarios. */
  calendarId?: string | null;
  /**
   * The calendar already existed and was assigned by the user: AUN does not
   * rename, recolour or archive it (it only does that with calendars it created).
   */
  calendarLinked?: boolean;
  /** AUN account of this person once they joined the family (shared cloud data). */
  accountUid?: string | null;
}

export type Member = Omit<Child, 'activities'> & { relation: MemberRelation; activities: MemberActivity[] };

export const SIZE_PRESETS = ['clothing', 'top', 'bottom', 'shoes', 'coat', 'underwear', 'hat'] as const;

export type FamilyListKind = 'tomorrow' | 'shopping';

/**
 * A checklist item of a family list. `childId = null` means "Casa"/general.
 * Events of a child live in Calendars and are linked through relations,
 * avoiding duplicated data (section 34).
 */
export interface FamilyItem extends BaseEntity {
  list: FamilyListKind;
  title: string;
  childId: string | null;
  /** Shopping: category key (see SHOPPING_CATEGORIES) or a custom label. */
  category?: string | null;
  store?: string | null;
  quantity?: string | null;
  /**
   * "Para mañana": routine items ("Preparar mochila") are never deleted —
   * they un-check themselves the next day.
   */
  routine?: boolean;
  done: boolean;
  doneAt?: string | null;
}

export type FamilyRelation = 'partner' | 'grandparent' | 'caregiver' | 'relative' | 'other';
export type FamilyRole = 'admin' | 'editor' | 'viewer';

/**
 * People the family will be shared with (section 35). Stored now so roles are
 * decided up-front; invitations are sent once accounts sync (Phase 9).
 */
export interface FamilyMember extends BaseEntity {
  name: string;
  email?: string | null;
  relation: FamilyRelation;
  role: FamilyRole;
  /** `local` until the invitation can be delivered by the backend. */
  status: 'local' | 'invited' | 'active';
}

export const SHOPPING_CATEGORIES = ['food', 'cleaning', 'hygiene', 'baby', 'pharmacy', 'clothes', 'school', 'home', 'other'] as const;
export type ShoppingCategory = (typeof SHOPPING_CATEGORIES)[number];

export type ShoppingGrouping = 'person' | 'category' | 'store';
