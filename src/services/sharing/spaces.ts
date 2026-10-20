/**
 * Sharing between AUN accounts (Firebase backend).
 *
 * A *space* is a set of rows shared with other people, with a role each:
 *   cal_<ownerUid>_<calendarId>  a calendar and its events
 *   fam_<ownerUid>               the family: members, "para mañana", shopping
 * Every other row (tasks, documents, notes, e-mail…) is private. The space
 * id embeds its owner, which the security rules (firestore.rules) rely on.
 *
 * A family is a group. Its owner and 'admin' members are adults who manage
 * it; 'edit' members (e.g. a child with an account) add and change family
 * data; 'view' members only see it. Any member can share one of their
 * calendars with the whole family (`family` + `familyRole` on the calendar
 * space): access follows family membership, enforced by the rules.
 */
export type ShareRole = 'view' | 'edit' | 'admin';
/** What a calendar shared with the family lets its members do. */
export type FamilyCalendarRole = 'view' | 'edit';
export type MyRole = 'owner' | ShareRole;

export interface Space {
  id: string;
  ownerId: string;
  kind: 'calendar' | 'family';
  /** Calendar id (calendar spaces). */
  refId: string | null;
  name: string;
  memberIds: string[];
  roles: Record<string, ShareRole>;
  /** Display names of the people in the space (uid → name). */
  names: Record<string, string>;
  /** Person this calendar is assigned to ("su calendario"). */
  assignee: string | null;
  /** Calendar spaces: family space it is shared with (everyone in it can see it). */
  family?: string | null;
  familyRole?: FamilyCalendarRole | null;
}

export interface Invite {
  code: string;
  ownerId: string;
  ownerName: string;
  /** spaceId → role granted. */
  grants: Record<string, ShareRole>;
  /** Calendar space that becomes "their calendar". */
  assign: string | null;
  /** Family profile (Familia) this person is. */
  memberRecordId: string | null;
  memberName: string | null;
  /** spaceId → name, to show what is shared before accepting. */
  spaceNames: Record<string, string>;
  createdAt: string;
  expiresAt: string;
  usedBy: string | null;
  usedByName: string | null;
}

export const calendarSpaceId = (ownerId: string, calendarId: string) => `cal_${ownerId}_${calendarId}`;
export const familySpaceId = (ownerId: string) => `fam_${ownerId}`;

/** Collections that belong to the family space. */
export const FAMILY_COLLECTIONS = new Set([
  'children',
  'familyItems',
  'familyMembers',
  'shoppingLists',
  'shoppingItems',
  'shoppingCategories',
]);

const isFamilySpace = (s: Pick<Space, 'id'>) => s.id.startsWith('fam_');

/** Owner of the family I belong to: someone else's if I joined it, otherwise mine. */
export function householdOwner(spaces: Space[], me: string): string {
  return spaces.find((s) => isFamilySpace(s) && s.ownerId !== me && s.memberIds.includes(me))?.ownerId ?? me;
}

/** The family space I am in (someone else's I joined, or my own), if it exists. */
export function myFamily(spaces: Space[], me: string): Space | null {
  return spaces.find((s) => s.id === familySpaceId(householdOwner(spaces, me))) ?? null;
}

/** Someone's role in a family ('admin' for its owner); `null` if not in it. */
export function familyRoleOf(family: Space | null, uid: string): ShareRole | null {
  if (!family || !family.memberIds.includes(uid)) return null;
  return family.ownerId === uid ? 'admin' : (family.roles[uid] ?? null);
}

/** Can this person invite people to the family and manage them? */
export function canManageFamily(family: Space | null, uid: string): boolean {
  return familyRoleOf(family, uid) === 'admin';
}

/** My role in a space; `null` = no access. Spaces in my own namespace are mine. */
export function roleIn(spaces: Space[], spaceId: string, me: string): MyRole | null {
  if (spaceId === familySpaceId(me) || spaceId.startsWith(`cal_${me}_`)) return 'owner';
  const s = spaces.find((x) => x.id === spaceId);
  if (!s) return null;
  const direct = s.memberIds.includes(me) ? (s.roles[me] ?? null) : null;
  // Shared with my family: what the family lets me do (same as the rules).
  const fam = s.family ? spaces.find((x) => x.id === s.family) : undefined;
  const famRole = familyRoleOf(fam ?? null, me);
  const viaFamily: MyRole | null = !famRole ? null : s.familyRole === 'edit' && famRole !== 'view' ? 'edit' : 'view';
  if (direct === 'edit' || direct === 'admin' || viaFamily === 'edit') return 'edit';
  return direct ?? viaFamily;
}

/** Can I see this space's rows (member, or shared with my family)? */
export function canSee(spaces: Space[], spaceId: string, me: string): boolean {
  return roleIn(spaces, spaceId, me) !== null;
}

/** Can I change this calendar's events (owner or editor)? */
export function canEditCalendar(spaces: Space[], calendar: { id: string; ownerId: string }, me: string): boolean {
  if (calendar.ownerId === me) return true;
  const role = roleIn(spaces, calendarSpaceId(calendar.ownerId, calendar.id), me);
  return role === 'edit' || role === 'owner';
}

/** The space a row is stored in (null = private). */
export async function spaceForRecord(
  collection: string,
  data: { id: string; ownerId?: string; calendarId?: string },
  ctx: { me: string; household: string; calendarOwner: (calendarId: string) => Promise<string | null> },
): Promise<string | null> {
  if (collection === 'calendars') return calendarSpaceId(data.ownerId || ctx.me, data.id);
  if (collection === 'events') {
    if (!data.calendarId) return null;
    const owner = await ctx.calendarOwner(data.calendarId);
    return owner ? calendarSpaceId(owner, data.calendarId) : null;
  }
  if (FAMILY_COLLECTIONS.has(collection)) return familySpaceId(ctx.household);
  return null;
}

/** People I share something with (members of my spaces and of my family), by name. */
export function peopleOf(spaces: Space[], me: string): { uid: string; name: string }[] {
  const out = new Map<string, string>();
  for (const s of spaces) {
    if (s.ownerId !== me && !(isFamilySpace(s) && s.memberIds.includes(me))) continue;
    for (const uid of s.memberIds) if (uid !== me) out.set(uid, s.names[uid] || out.get(uid) || '');
  }
  return [...out].map(([uid, name]) => ({ uid, name })).sort((a, b) => a.name.localeCompare(b.name));
}
