import type { Repository } from '@/storage/repository';
import type { StoredFileRef } from '@/storage/providers/types';
import { matchScore, type SearchResult } from '@/types/search';
import { toDateKey, type DateKey } from '@/utils/date';
import type {
  Child,
  FamilyItem,
  FamilyListKind,
  FamilyMember,
  FamilyRelation,
  FamilyRole,
  Member,
  MemberActivity,
  MemberField,
  MemberHealth,
  MemberRelation,
  MemberSize,
} from './types';

export interface ChildInput {
  name: string;
  color: string;
  relation?: MemberRelation;
  birthDate?: string | null;
  phone?: string | null;
  email?: string | null;
  school?: string | null;
  schoolClass?: string | null;
  occupation?: string | null;
  sizes?: MemberSize[];
  health?: MemberHealth | null;
  extraFields?: MemberField[];
  importantInfo?: string | null;
  notes?: string | null;
}

export interface ActivityInput {
  id?: string;
  name: string;
  weekdays: number[];
  startTime?: string | null;
  endTime?: string | null;
  place?: string | null;
  notes?: string | null;
}

/**
 * What Familia needs from Calendarios, injected by the composition root so
 * the modules stay decoupled: one calendar per member, and a weekly event per
 * scheduled activity.
 */
export interface MemberCalendarBridge {
  createCalendar(name: string, color: string): Promise<string>;
  updateCalendar(id: string, patch: { name?: string; color?: string; isActive?: boolean }): Promise<void>;
  /** Creates or updates the weekly event of an activity; returns its id. */
  upsertActivityEvent(input: { calendarId: string; eventId?: string | null; activity: MemberActivity; memberId: string }): Promise<string>;
  deleteEvent(id: string): Promise<void>;
}

/** Old profiles stored activities as plain names and had no relation. */
export function normalizeMember(c: Child): Member {
  return {
    ...c,
    relation: c.relation ?? 'child',
    activities: (c.activities ?? []).map((a, i) =>
      typeof a === 'string' ? { id: `legacy-${i}`, name: a, weekdays: [] } : { ...a, weekdays: a.weekdays ?? [] },
    ),
    sizes: c.sizes ?? [],
    extraFields: c.extraFields ?? [],
  };
}

const cleanList = <T extends { value: string }>(list: T[] | undefined) =>
  (list ?? []).map((x) => ({ ...x, value: x.value.trim() })).filter((x) => x.value);

export interface ItemInput {
  title: string;
  childId: string | null;
  category?: string | null;
  store?: string | null;
  quantity?: string | null;
  routine?: boolean;
}

export interface MemberInput {
  name: string;
  email?: string | null;
  relation: FamilyRelation;
  role: FamilyRole;
}

const clean = (v: string | null | undefined) => v?.trim() || null;

/** Routine items checked on an earlier day start unchecked again. */
export function needsReset(item: FamilyItem, today: DateKey): boolean {
  return !!item.routine && item.done && !!item.doneAt && toDateKey(new Date(item.doneAt)) < today;
}

/** In-flight calendar creations, shared by every FamilyService instance. */
const calendarCreation = new Map<string, Promise<string | null>>();

export class FamilyService {
  constructor(
    private readonly children: Repository<Child>,
    private readonly items: Repository<FamilyItem>,
    private readonly members: Repository<FamilyMember>,
    private readonly calendar?: MemberCalendarBridge,
  ) {}

  // ---------- Members (children, partner, grandparents…) ----------

  async listChildren(): Promise<Member[]> {
    const rows = (await this.children.list()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    // Members created before calendars were automatic get theirs once.
    if (this.calendar) {
      for (const r of rows.filter((x) => !x.calendarId)) {
        r.calendarId = await this.ensureCalendar(r.id);
      }
    }
    return rows.map(normalizeMember);
  }

  /**
   * Idempotent across concurrent calls and service instances (the container is
   * rebuilt on sign-in): one in-flight creation per member, and the row is
   * re-read right before creating so a calendar is never made twice.
   */
  private ensureCalendar(memberId: string): Promise<string | null> {
    const running = calendarCreation.get(memberId);
    if (running) return running;
    const job = (async () => {
      const fresh = await this.children.get(memberId);
      if (!fresh || !this.calendar) return null;
      if (fresh.calendarId) return fresh.calendarId;
      const calendarId = await this.calendar.createCalendar(fresh.name, fresh.color);
      await this.children.update(memberId, { calendarId });
      return calendarId;
    })().finally(() => calendarCreation.delete(memberId));
    calendarCreation.set(memberId, job);
    return job;
  }

  async getChild(id: string): Promise<Member | null> {
    const c = await this.children.get(id);
    return c ? normalizeMember(c) : null;
  }

  async createChild(input: ChildInput): Promise<Member> {
    const name = input.name.trim();
    if (!name) throw new Error('Name is required');
    const calendarId = this.calendar ? await this.calendar.createCalendar(name, input.color) : null;
    const created = await this.children.create({
      name,
      relation: input.relation ?? 'child',
      color: input.color,
      birthDate: input.birthDate ?? null,
      phone: clean(input.phone),
      email: clean(input.email),
      school: clean(input.school),
      schoolClass: clean(input.schoolClass),
      occupation: clean(input.occupation),
      sizes: cleanList(input.sizes),
      health: input.health ?? null,
      extraFields: cleanList(input.extraFields),
      importantInfo: clean(input.importantInfo),
      activities: [],
      notes: clean(input.notes),
      photo: null,
      calendarId,
    });
    return normalizeMember(created);
  }

  async updateChild(id: string, input: Partial<ChildInput>): Promise<Member> {
    const patch: Partial<Child> = { ...input };
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) throw new Error('Name is required');
      patch.name = name;
    }
    for (const k of ['phone', 'email', 'school', 'schoolClass', 'occupation', 'importantInfo', 'notes'] as const)
      if (k in input) patch[k] = clean(input[k]);
    if (input.sizes) patch.sizes = cleanList(input.sizes);
    if (input.extraFields) patch.extraFields = cleanList(input.extraFields);
    const updated = await this.children.update(id, patch);
    // The member's calendar follows the name and colour.
    if (this.calendar && updated.calendarId && (input.name !== undefined || input.color !== undefined)) {
      await this.calendar.updateCalendar(updated.calendarId, { name: updated.name, color: updated.color });
    }
    return normalizeMember(updated);
  }

  setChildPhoto(id: string, photo: StoredFileRef | null): Promise<Child> {
    return this.children.update(id, { photo });
  }

  /**
   * Replaces the member's activities. Each one with days (and optionally a
   * time) becomes a weekly event in the member's calendar; removing it, or
   * clearing its days, removes the event.
   */
  async saveActivities(memberId: string, activities: ActivityInput[]): Promise<Member> {
    const current = await this.getChild(memberId);
    if (!current) throw new Error('not-found');
    const prev = new Map(current.activities.map((a) => [a.id, a]));
    const next: MemberActivity[] = [];
    for (const input of activities) {
      const name = input.name.trim();
      if (!name) continue;
      const old = input.id ? prev.get(input.id) : undefined;
      const activity: MemberActivity = {
        id: old?.id && !old.id.startsWith('legacy-') ? old.id : `act-${Date.now().toString(36)}-${next.length}`,
        name,
        weekdays: [...new Set(input.weekdays)].sort(),
        startTime: input.startTime || null,
        endTime: input.endTime || null,
        place: clean(input.place),
        notes: clean(input.notes),
        eventId: old?.eventId ?? null,
      };
      if (this.calendar && current.calendarId && activity.weekdays.length) {
        activity.eventId = await this.calendar.upsertActivityEvent({
          calendarId: current.calendarId,
          eventId: activity.eventId,
          activity,
          memberId,
        });
      } else if (this.calendar && activity.eventId) {
        await this.calendar.deleteEvent(activity.eventId);
        activity.eventId = null;
      }
      next.push(activity);
    }
    const kept = new Set(next.map((a) => a.id));
    for (const old of current.activities) {
      if (!kept.has(old.id) && old.eventId && this.calendar) await this.calendar.deleteEvent(old.eventId);
    }
    return normalizeMember(await this.children.update(memberId, { activities: next }));
  }

  /** Removes the profile; their calendar is archived (events kept, hidden), list items move to "Casa". */
  async removeChild(id: string): Promise<Member | null> {
    const child = await this.getChild(id);
    for (const item of (await this.items.list()).filter((i) => i.childId === id)) {
      await this.items.update(item.id, { childId: null });
    }
    if (this.calendar && child?.calendarId) await this.calendar.updateCalendar(child.calendarId, { isActive: false });
    await this.children.remove(id);
    return child;
  }

  // ---------- Lists ----------

  /** Items of a list; routine items done on a previous day are un-checked first. */
  async listItems(list: FamilyListKind, today: DateKey = toDateKey(new Date())): Promise<FamilyItem[]> {
    const all = (await this.items.list()).filter((i) => i.list === list);
    for (const item of all) {
      if (!needsReset(item, today)) continue;
      Object.assign(item, await this.items.update(item.id, { done: false, doneAt: null }));
    }
    return all.sort((a, b) => Number(a.done) - Number(b.done) || a.createdAt.localeCompare(b.createdAt));
  }

  async addItem(list: FamilyListKind, input: ItemInput): Promise<FamilyItem> {
    const title = input.title.trim();
    if (!title) throw new Error('Title is required');
    return this.items.create({
      list,
      title,
      childId: input.childId,
      done: false,
      doneAt: null,
      category: clean(input.category),
      store: clean(input.store),
      quantity: clean(input.quantity),
      routine: list === 'tomorrow' ? !!input.routine : false,
    });
  }

  updateItem(id: string, input: Partial<ItemInput>): Promise<FamilyItem> {
    const patch: Partial<FamilyItem> = { ...input };
    if (input.title !== undefined) {
      const title = input.title.trim();
      if (!title) throw new Error('Title is required');
      patch.title = title;
    }
    for (const k of ['category', 'store', 'quantity'] as const) if (k in input) patch[k] = clean(input[k]);
    return this.items.update(id, patch);
  }

  toggleItem(item: FamilyItem): Promise<FamilyItem> {
    const done = !item.done;
    return this.items.update(item.id, { done, doneAt: done ? new Date().toISOString() : null });
  }

  removeItem(id: string): Promise<void> {
    return this.items.remove(id);
  }

  /** Clears checked items: one-off items are deleted, routines are un-checked. */
  async clearDone(list: FamilyListKind): Promise<number> {
    const done = (await this.listItems(list)).filter((i) => i.done);
    await this.items.removeMany(done.filter((i) => !i.routine).map((i) => i.id));
    for (const r of done.filter((i) => i.routine)) await this.items.update(r.id, { done: false, doneAt: null });
    return done.length;
  }

  /** Stores already used, most frequent first (shopping suggestions). */
  async knownStores(): Promise<string[]> {
    const counts = new Map<string, number>();
    for (const i of await this.items.list()) if (i.store) counts.set(i.store, (counts.get(i.store) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
  }

  // ---------- Sharing (section 35) ----------

  async listMembers(): Promise<FamilyMember[]> {
    return (await this.members.list()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async addMember(input: MemberInput): Promise<FamilyMember> {
    const name = input.name.trim();
    if (!name) throw new Error('Name is required');
    const email = clean(input.email);
    if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new Error('Invalid email');
    return this.members.create({ name, email, relation: input.relation, role: input.role, status: 'local' });
  }

  updateMember(id: string, input: Partial<MemberInput>): Promise<FamilyMember> {
    const patch: Partial<FamilyMember> = { ...input };
    if ('email' in input) patch.email = clean(input.email);
    return this.members.update(id, patch);
  }

  removeMember(id: string): Promise<void> {
    return this.members.remove(id);
  }

  // ---------- Search ----------

  async search(text: string): Promise<SearchResult[]> {
    const children = await this.listChildren();
    const names = new Map(children.map((c) => [c.id, c.name]));
    const results: SearchResult[] = [];
    for (const c of children) {
      const score = Math.max(matchScore(c.name, text), matchScore(c.school ?? '', text) ? 1 : 0);
      if (score)
        results.push({
          ref: { module: 'family', type: 'child', id: c.id },
          title: c.name,
          kindKey: 'search.kinds.child',
          subtitle: c.school ?? undefined,
          score: score + 1,
          route: `/family/child/${c.id}`,
        });
    }
    for (const i of await this.items.list()) {
      const score = matchScore(i.title, text);
      if (!score) continue;
      results.push({
        ref: { module: 'family', type: 'item', id: i.id },
        title: i.title,
        kindKey: i.list === 'tomorrow' ? 'search.kinds.tomorrowItem' : 'search.kinds.shoppingItem',
        subtitle: i.childId ? names.get(i.childId) : undefined,
        score: score + (i.done ? 0 : 1),
        route: i.childId ? `/family/child/${i.childId}` : '/family',
      });
    }
    return results;
  }
}
