import { createServices } from '@/services/container';
import { memoryStore } from '@/test/memoryStore';
import { wipeUserContent } from '../wipe';

// jest.mock factories run lazily and must use require().
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
let mockId = 0;
jest.mock('@/utils/id', () => ({ createId: () => `id-${++mockId}` }));

describe('wipeUserContent', () => {
  it('empties every module but keeps other users and leaves tombstones to sync', async () => {
    const kv = memoryStore();
    const me = createServices('me', kv, null);
    const other = createServices('other', kv, null);
    await me.tasks.quickAdd({ title: 'Comprar pan' });
    await me.calendars.createCalendar({ name: 'Familia', color: '#f00' });
    await me.family.createChild({ name: 'Elisa', color: '#f0f' });
    await me.family.addItem('shopping', { title: 'Leche', childId: null });
    await me.notifications.createReminder({ title: 'Regalo', date: '2026-10-09', time: '18:00' });
    await me.secondBrain.createFolder('Seguros', null);
    await other.tasks.quickAdd({ title: 'No es mío' });

    const r = await wipeUserContent(me, kv);
    // 6 explicit rows + the calendar created automatically for the family member.
    expect(r.rows).toBe(7);
    for (const repo of me.collections.values()) expect(await repo.list()).toHaveLength(0);
    // Deletions are tombstones (dirty) so the sync engine propagates them.
    const raw = await me.collections.get('tasks')!.listAllRaw();
    expect(raw[0]).toMatchObject({ dirty: true });
    expect(raw[0].deletedAt).toBeTruthy();
    expect((await other.tasks.list()).map((t) => t.title)).toEqual(['No es mío']);
  });
});
