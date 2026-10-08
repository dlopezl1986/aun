/**
 * Sharing between AUN accounts (Firebase backend).
 *
 * A *space* is a set of rows shared with other people, with a role each:
 *   cal_<ownerUid>_<calendarId>  a calendar and its events
 *   fam_<ownerUid>               the family: members, "para mañana", shopping
 * Every other row (tasks, documents, notes, e-mail…) is private. The space
 * id embeds its owner, which the security rules (firestore.rules) rely on.
 */
export type ShareRole = 'view' | 'edit';
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

/** Owner of the family I belong to: someone else's if I joined it, otherwise mine. */
export function householdOwner(spaces: Space[], me: string): string {
  return spaces.find((s) => s.kind === 'family' && s.ownerId !== me && s.memberIds.includes(me))?.ownerId ?? me;
}

/** My role in a space; `null` = no access. Spaces in my own namespace are mine. */
export function roleIn(spaces: Space[], spaceId: string, me: string): MyRole | null {
  if (spaceId === familySpaceId(me) || spaceId.startsWith(`cal_${me}_`)) return 'owner';
  const s = spaces.find((x) => x.id === spaceId);
  return s && s.memberIds.includes(me) ? (s.roles[me] ?? null) : null;
}

/** Can I change this calendar's events (owner or editor)? */
export function canEditCalendar(spaces: Space[], calendar: { id: string; ownerId: string }, me: string): boolean {
  if (calendar.ownerId === me) return true;
  return roleIn(spaces, calendarSpaceId(calendar.ownerId, calendar.id), me) === 'edit';
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

/** People I share something with (members of my own spaces), by name. */
export function peopleOf(spaces: Space[], me: string): { uid: string; name: string }[] {
  const out = new Map<string, string>();
  for (const s of spaces) {
    if (s.ownerId !== me) continue;
    for (const uid of s.memberIds) if (uid !== me) out.set(uid, s.names[uid] || out.get(uid) || '');
  }
  return [...out].map(([uid, name]) => ({ uid, name })).sort((a, b) => a.name.localeCompare(b.name));
}
