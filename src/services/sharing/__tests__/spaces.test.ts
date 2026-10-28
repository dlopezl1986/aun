import { createServices } from '@/services/container';
import { memoryStore } from '@/test/memoryStore';
import type { PullPage, RemoteRecord, RemoteStore } from '@/services/sync/types';
import {
  accessViaFamily,
  canEditCalendar,
  familyAccessFor,
  canManageFamily,
  canSee,
  familyRoleOf,
  householdOwner,
  myFamily,
  peopleOf,
  personCalendarAccess,
  roleIn,
  spaceForRecord,
  type Space,
} from '../spaces';

// jest.mock factories run lazily and must use require().
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
let mockId = 0;
jest.mock('@/utils/id', () => ({ createId: () => `id-${++mockId}` }));

const space = (id: string, ownerId: string, extra: Partial<Space> = {}): Space => ({
  id,
  ownerId,
  kind: id.startsWith('fam_') ? 'family' : 'calendar',
  refId: null,
  name: id,
  memberIds: [ownerId],
  roles: {},
  names: {},
  assignee: null,
  ...extra,
});

describe('sharing spaces', () => {
  const spaces = [
    space('fam_david', 'david', { memberIds: ['david', 'soraya'], roles: { soraya: 'edit' } }),
    space('cal_david_kids', 'david', { memberIds: ['david', 'soraya'], roles: { soraya: 'view' } }),
    space('cal_david_sora', 'david', { memberIds: ['david', 'soraya'], roles: { soraya: 'edit' }, assignee: 'soraya' }),
  ];

  it('knows each person’s role and family', () => {
    expect(roleIn(spaces, 'cal_david_kids', 'david')).toBe('owner');
    expect(roleIn(spaces, 'cal_david_kids', 'soraya')).toBe('view');
    expect(roleIn(spaces, 'cal_david_sora', 'soraya')).toBe('edit');
    expect(roleIn(spaces, 'cal_david_work', 'soraya')).toBeNull();
    expect(householdOwner(spaces, 'soraya')).toBe('david');
    expect(householdOwner(spaces, 'david')).toBe('david');
    expect(householdOwner([], 'carol')).toBe('carol');
    expect(canEditCalendar(spaces, { id: 'kids', ownerId: 'david' }, 'soraya')).toBe(false);
    expect(canEditCalendar(spaces, { id: 'sora', ownerId: 'david' }, 'soraya')).toBe(true);
    expect(canEditCalendar(spaces, { id: 'mine', ownerId: 'soraya' }, 'soraya')).toBe(true);
  });

  it('puts calendars and events in their calendar’s space, family and shopping in the family, the rest private', async () => {
    const ctx = { me: 'soraya', household: 'david', calendarOwner: async (id: string) => (id === 'kids' ? 'david' : null) };
    expect(await spaceForRecord('calendars', { id: 'kids', ownerId: 'david' }, ctx)).toBe('cal_david_kids');
    expect(await spaceForRecord('events', { id: 'e1', calendarId: 'kids' }, ctx)).toBe('cal_david_kids');
    expect(await spaceForRecord('events', { id: 'e2', calendarId: 'unknown' }, ctx)).toBeNull();
    expect(await spaceForRecord('shoppingItems', { id: 's1' }, ctx)).toBe('fam_david');
    expect(await spaceForRecord('children', { id: 'c1' }, ctx)).toBe('fam_david');
    expect(await spaceForRecord('tasks', { id: 't1' }, ctx)).toBeNull();
    expect(await spaceForRecord('documents', { id: 'd1' }, ctx)).toBeNull();
    expect(await spaceForRecord('dayNotes', { id: 'n1' }, ctx)).toBeNull();
  });

  it('each person keeps the access chosen for them, even with the calendar shared with the whole family', () => {
    const fam = space('fam_david', 'david', { memberIds: ['david', 'soraya', 'leo'], roles: { soraya: 'admin', leo: 'view' } });
    const shared = space('cal_david_casa', 'david', { family: 'fam_david', familyRole: 'edit' });
    // Soraya (adult) edits through the family; Leo (only sees the family) just sees it.
    expect(personCalendarAccess([fam, shared], 'cal_david_casa', 'soraya')).toBe('edit');
    expect(personCalendarAccess([fam, shared], 'cal_david_casa', 'leo')).toBe('view');
    expect(personCalendarAccess([fam, shared], 'cal_david_work', 'soraya')).toBe('none');
    expect(accessViaFamily(fam, 'leo', 'edit')).toBe('view');
    expect(accessViaFamily(fam, 'carol', 'edit')).toBe('none');
    // Soraya set to "ver": the family can no longer edit; to "nada": the family cannot even see it.
    expect(familyAccessFor(fam, 'edit', { soraya: 'edit', leo: 'view' })).toBe('edit');
    expect(familyAccessFor(fam, 'edit', { soraya: 'view', leo: 'view' })).toBe('view');
    expect(familyAccessFor(fam, 'edit', { soraya: 'none', leo: 'view' })).toBe('none');
    expect(familyAccessFor(fam, 'view', { soraya: 'edit', leo: 'edit' })).toBe('view');
  });
});

describe('sync engine with a sharing backend', () => {
  function fakeRemote(opts: { schema?: number; reject?: (r: RemoteRecord) => boolean } = {}) {
    const pushed: RemoteRecord[] = [];
    const server = new Map<string, RemoteRecord>();
    const remote: RemoteStore = {
      id: 'fake',
      schema: opts.schema,
      pull: async (): Promise<PullPage> => ({ records: [], cursor: null, hasMore: false }),
      push: async (records) => {
        const restored: RemoteRecord[] = [];
        for (const r of records) {
          if (opts.reject?.(r)) {
            const s = server.get(r.id);
            restored.push(s ?? { ...r, deletedAt: '2026-10-08T00:00:00.000Z' });
          } else {
            pushed.push(r);
            server.set(r.id, r);
          }
        }
        return { restored };
      },
    };
    return { remote, pushed, server };
  }

  it('re-uploads every row once when the server format changes', async () => {
    const kv = memoryStore();
    const first = fakeRemote();
    const a = createServices('u', kv, first.remote);
    await a.tasks.quickAdd({ title: 'Uno' });
    await a.calendars.createCalendar({ name: 'Casa', color: '#f00' });
    await a.sync!.sync();
    expect(first.pushed).toHaveLength(2);
    const upgraded = fakeRemote({ schema: 2 });
    const b = createServices('u', kv, upgraded.remote);
    await b.sync!.sync();
    expect(upgraded.pushed).toHaveLength(2); // everything again, once
    await b.sync!.sync();
    expect(upgraded.pushed).toHaveLength(2); // …and not again
  });

  it('a change the server rejects (no permission) goes back to the server version instead of retrying forever', async () => {
    const kv = memoryStore();
    const f = fakeRemote({ reject: (r) => r.data && (r.data as { title?: string }).title === 'Sin permiso' });
    const s = createServices('u', kv, f.remote);
    const cal = await s.calendars.createCalendar({ name: 'Niños', color: '#f00' });
    const base = {
      calendarId: cal.id,
      allDay: false,
      startDate: '2026-10-12',
      startTime: '10:00',
      endDate: '2026-10-12',
      endTime: '11:00',
    };
    const e = await s.calendars.createEvent({ ...base, title: 'Cole' });
    await s.sync!.sync();
    await s.calendars.updateEvent(e.id, { ...base, title: 'Sin permiso' });
    await s.sync!.sync();
    expect((await s.calendars.getEvent(e.id))?.title).toBe('Cole');
    expect(await s.sync!.pending()).toHaveLength(0);
    // A rejected new row that the server does not have disappears.
    const e2 = await s.calendars.createEvent({ ...base, title: 'Sin permiso' });
    await s.sync!.sync();
    expect(await s.calendars.getEvent(e2.id)).toBeNull();
  });

  it('a hung connection does not block later syncs, and "full" downloads everything again', async () => {
    jest.useFakeTimers();
    const kv = memoryStore();
    let hang = true;
    const cursors: (string | null)[] = [];
    const remote: RemoteStore = {
      id: 'fake',
      pull: async (cursor): Promise<PullPage> => {
        cursors.push(cursor);
        if (hang) return new Promise<PullPage>(() => undefined); // never answers
        return { records: [], cursor: 'c1', hasMore: false };
      },
      push: async () => ({ restored: [] }),
    };
    const s = createServices('u', kv, remote);
    const first = s.sync!.sync();
    const firstFailed = expect(first).rejects.toMatchObject({ code: 'offline' });
    await jest.advanceTimersByTimeAsync(91_000);
    await firstFailed;
    jest.useRealTimers();
    hang = false;
    await s.sync!.sync(); // runs instead of waiting forever on the hung one
    await s.sync!.sync();
    expect(cursors.slice(-1)[0]).toBe('c1');
    await s.sync!.sync({ full: true });
    expect(cursors.slice(-1)[0]).toBeNull();
  });
});

describe('fast, safe family sync', () => {
  const at = (s: string) => `2026-10-0${s}T10:00:00.000Z`;
  const row = (id: string, ownerId: string, extra: Record<string, unknown> = {}) =>
    ({ id, ownerId, createdAt: at('1'), updatedAt: at('1'), deletedAt: null, title: id, ...extra }) as never;
  const idle = (extra: Partial<RemoteStore> = {}): RemoteStore => ({
    id: 'fake',
    pull: async () => ({ records: [], cursor: null, hasMore: false }),
    push: async () => ({ restored: [] }),
    ...extra,
  });

  it('an edit right after receiving a row from a device whose clock runs ahead still wins', async () => {
    const s = createServices('u', memoryStore(), null);
    const tasks = s.collections.get('tasks')!;
    const future = new Date(Date.now() + 3_600_000).toISOString();
    await tasks.mergeRemote([{ ...(row('t1', 'u') as object), updatedAt: future } as never]);
    const edited = await s.tasks.update('t1', { title: 'Mío, después' });
    expect(edited.updatedAt > future).toBe(true);
  });

  it('every change made on this device is announced (to upload it at once), synced ones are not', async () => {
    const s = createServices('u', memoryStore(), idle());
    const seen: string[] = [];
    const off = s.onLocalChange((c) => seen.push(c));
    const t = await s.tasks.quickAdd({ title: 'Uno' });
    await s.collections.get('events')!.mergeRemote([row('e1', 'other')]);
    await s.sync!.sync();
    await s.tasks.remove(t.id);
    off();
    await s.tasks.quickAdd({ title: 'Dos' });
    expect(seen.filter((c) => c === 'tasks')).toHaveLength(2);
    expect(seen).not.toContain('events');
  });

  it('a change made while a sync is running is uploaded right after it, not left behind', async () => {
    const pushed: string[] = [];
    let release: () => void = () => undefined;
    let first = true;
    const s = createServices(
      'u',
      memoryStore(),
      idle({
        push: async (records) => {
          if (first) {
            first = false;
            await new Promise<void>((r) => (release = r));
          }
          pushed.push(...records.map((r) => (r.data as unknown as { title: string }).title));
          return { restored: [] };
        },
      }),
    );
    await s.tasks.quickAdd({ title: 'Antes' });
    const running = s.sync!.sync();
    await new Promise((r) => setTimeout(r, 5));
    await s.tasks.quickAdd({ title: 'Durante' });
    const queued = s.sync!.sync();
    release();
    await running;
    await queued;
    expect(pushed).toEqual(['Antes', 'Durante']);
    expect(await s.sync!.pending()).toHaveLength(0);
  });

  it('joining someone’s family uploads my own rows again (to move them there), never theirs', async () => {
    const kv = memoryStore();
    let household = 'u';
    const pushed: string[] = [];
    const remote = idle({
      layout: async () => household,
      push: async (records) => {
        pushed.push(...records.map((r) => r.id));
        return { restored: [] };
      },
    });
    const s = createServices('u', kv, remote);
    const mine = await s.tasks.quickAdd({ title: 'Mía' });
    await s.collections.get('shoppingItems')!.mergeRemote([row('theirs', 'partner')]);
    await s.sync!.sync();
    expect(pushed).toEqual([mine.id]);
    household = 'partner';
    await s.sync!.sync();
    expect(pushed).toEqual([mine.id, mine.id]);
    await s.sync!.sync();
    expect(pushed).toHaveLength(2); // once
    household = 'u'; // leaving: what I added stays in that family
    await s.sync!.sync();
    expect(pushed).toHaveLength(2);
  });

  it('when someone stops sharing with me, their rows leave this device; mine stay', async () => {
    const s = createServices('u', memoryStore(), idle({ isGone: (_c, r) => r.space === 'cal_partner_kids' && r.ownerId !== 'u' }));
    const events = s.collections.get('events')!;
    await events.mergeRemote([
      row('theirs', 'partner', { space: 'cal_partner_kids' }),
      row('mine-there', 'u', { space: 'cal_partner_kids' }),
      row('still-shared', 'partner', { space: 'fam_partner' }),
    ]);
    await s.sync!.sync();
    expect((await events.listAllRaw()).map((r) => r.id).sort()).toEqual(['mine-there', 'still-shared']);
  });

  it('live changes from the family are merged at once and the screens told to refresh', async () => {
    let handlers: Parameters<NonNullable<RemoteStore['watch']>>[0] | null = null;
    const s = createServices('u', memoryStore(), idle({ watch: (h) => ((handlers = h), () => undefined) }));
    const onChanged = jest.fn();
    const onAccess = jest.fn();
    s.sync!.watch({ onChanged, onAccess });
    const record: RemoteRecord = {
      collection: 'shoppingItems',
      id: 'milk',
      data: row('milk', 'partner', { space: 'fam_partner' }),
      updatedAt: at('2'),
      deletedAt: null,
    };
    handlers!.onRecords([record]);
    await new Promise((r) => setTimeout(r, 10));
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect((await s.collections.get('shoppingItems')!.list()).map((r) => r.id)).toEqual(['milk']);
    handlers!.onRecords([record]); // the same version again (e.g. our echo): nothing to refresh
    await new Promise((r) => setTimeout(r, 10));
    expect(onChanged).toHaveBeenCalledTimes(1);
    handlers!.onAccess();
    expect(onAccess).toHaveBeenCalled();
  });

  it('a pushed row never carries local-only fields (dirty, space)', async () => {
    const pushed: RemoteRecord[] = [];
    const s = createServices(
      'u',
      memoryStore(),
      idle({
        push: async (r) => {
          pushed.push(...r);
          return { restored: [] };
        },
      }),
    );
    await s.collections.get('tasks')!.mergeRemote([row('t', 'u', { space: null })]);
    await s.tasks.update('t', { title: 'cambiada' });
    await s.sync!.sync();
    expect(pushed).toHaveLength(1);
    expect('space' in pushed[0].data).toBe(false);
    expect('dirty' in pushed[0].data).toBe(false);
  });
});

describe('families as groups', () => {
  // Pa created the family; Ma is an adult (admin); Kid has an account (edit); Gran only views.
  const fam = space('fam_pa', 'pa', {
    memberIds: ['pa', 'ma', 'kid', 'gran'],
    roles: { ma: 'admin', kid: 'edit', gran: 'view' },
    names: { pa: 'Pa', ma: 'Ma', kid: 'Kid', gran: 'Gran' },
  });
  const home = space('cal_pa_home', 'pa', { family: 'fam_pa', familyRole: 'edit' });
  const work = space('cal_pa_work', 'pa', { family: 'fam_pa', familyRole: 'view' });
  const gym = space('cal_ma_gym', 'ma', { family: 'fam_pa', familyRole: 'edit' });
  const spaces = [fam, home, work, gym];

  it('everyone has a role; the creator and adults manage it', () => {
    expect(familyRoleOf(fam, 'pa')).toBe('admin');
    expect(familyRoleOf(fam, 'ma')).toBe('admin');
    expect(familyRoleOf(fam, 'kid')).toBe('edit');
    expect(familyRoleOf(fam, 'eve')).toBeNull();
    expect(canManageFamily(fam, 'ma')).toBe(true);
    expect(canManageFamily(fam, 'kid')).toBe(false);
    for (const u of ['pa', 'ma', 'kid', 'gran']) expect(myFamily(spaces, u)?.id).toBe('fam_pa');
    expect(householdOwner(spaces, 'kid')).toBe('pa');
  });

  it('calendars shared with the family: everyone sees them, adults and relatives edit the editable ones', () => {
    expect(roleIn(spaces, 'cal_pa_home', 'ma')).toBe('edit');
    expect(roleIn(spaces, 'cal_pa_home', 'kid')).toBe('edit');
    expect(roleIn(spaces, 'cal_pa_home', 'gran')).toBe('view');
    expect(roleIn(spaces, 'cal_pa_work', 'ma')).toBe('view');
    expect(roleIn(spaces, 'cal_ma_gym', 'pa')).toBe('edit');
    expect(canEditCalendar(spaces, { id: 'gym', ownerId: 'ma' }, 'pa')).toBe(true);
    expect(canEditCalendar(spaces, { id: 'work', ownerId: 'pa' }, 'kid')).toBe(false);
    expect(canSee(spaces, 'cal_pa_work', 'gran')).toBe(true);
    expect(canSee(spaces, 'cal_pa_home', 'eve')).toBe(false);
  });

  it('leaving the family ends access to its calendars', () => {
    const without = [{ ...fam, memberIds: ['pa', 'ma', 'kid'] }, home, work, gym];
    expect(canSee(without, 'cal_pa_home', 'gran')).toBe(false);
    expect(myFamily(without, 'gran')).toBeNull();
  });

  it('every family member sees every other member (not only the creator)', () => {
    expect(peopleOf(spaces, 'kid').map((p) => p.name)).toEqual(['Gran', 'Ma', 'Pa']);
    expect(peopleOf(spaces, 'ma').map((p) => p.name)).toEqual(['Gran', 'Kid', 'Pa']);
  });
});
