import { createServices } from '@/services/container';
import { memoryStore } from '@/test/memoryStore';
import type { PullPage, RemoteRecord, RemoteStore } from '@/services/sync/types';
import { canEditCalendar, householdOwner, roleIn, spaceForRecord, type Space } from '../spaces';

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
