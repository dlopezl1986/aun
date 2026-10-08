import { LocalRepository } from '@/storage/repository';
import { memoryStore } from '@/test/memoryStore';
import { FamilyService, needsReset } from '../service';
import type { Child, FamilyItem, FamilyMember } from '../types';

// jest.mock factories run lazily and must use require().
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/utils/id', () => {
  let i = 0;
  return { createId: () => `id-${++i}` };
});

function setup() {
  const kv = memoryStore();
  const repo = <T extends { id: string }>(c: string) => new LocalRepository<T & never>(kv, 'u', c);
  return new FamilyService(repo<Child>('children'), repo<FamilyItem>('familyItems'), repo<FamilyMember>('familyMembers'));
}

describe('FamilyService', () => {
  it('un-checks routine "para mañana" items the next day, keeps one-off items checked', async () => {
    const s = setup();
    const elisa = await s.createChild({ name: 'Elisa', color: '#f00' });
    const backpack = await s.addItem('tomorrow', { title: 'Preparar mochila', childId: elisa.id, routine: true });
    const slip = await s.addItem('tomorrow', { title: 'Firmar autorización', childId: elisa.id });
    await s.toggleItem(backpack);
    await s.toggleItem(slip);

    // Same day: still done.
    const today = new Date().toISOString().slice(0, 10);
    expect((await s.listItems('tomorrow', today)).every((i) => i.done)).toBe(true);

    // Next day: the routine resets, the one-off stays done until cleared.
    const next = new Date(Date.now() + 86_400_000);
    const nextKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
    const items = await s.listItems('tomorrow', nextKey);
    expect(items.find((i) => i.id === backpack.id)?.done).toBe(false);
    expect(items.find((i) => i.id === slip.id)?.done).toBe(true);
  });

  it('clearDone deletes one-off items and un-checks routines', async () => {
    const s = setup();
    const routine = await s.addItem('tomorrow', { title: 'Merienda', childId: null, routine: true });
    const once = await s.addItem('tomorrow', { title: 'Disfraz', childId: null });
    await s.toggleItem(routine);
    await s.toggleItem(once);
    expect(await s.clearDone('tomorrow')).toBe(2);
    const items = await s.listItems('tomorrow');
    expect(items.map((i) => [i.title, i.done])).toEqual([['Merienda', false]]);
  });

  it('never marks shopping items as routines and tracks known stores', async () => {
    const s = setup();
    const milk = await s.addItem('shopping', { title: 'Leche', childId: null, store: ' Mercadona ', category: 'food', routine: true });
    await s.addItem('shopping', { title: 'Pan', childId: null, store: 'Mercadona' });
    await s.addItem('shopping', { title: 'Ibuprofeno', childId: null, store: 'Farmacia' });
    expect(milk.routine).toBe(false);
    expect(milk.store).toBe('Mercadona');
    expect(await s.knownStores()).toEqual(['Mercadona', 'Farmacia']);
  });

  it('moves a removed child\'s items to "Casa" and returns the profile', async () => {
    const s = setup();
    const javi = await s.createChild({ name: 'Javi', color: '#00f' });
    expect(javi.relation).toBe('child');
    await s.addItem('shopping', { title: 'Zapatillas', childId: javi.id });
    const removed = await s.removeChild(javi.id);
    expect(removed?.name).toBe('Javi');
    expect((await s.listItems('shopping'))[0].childId).toBeNull();
  });

  it('validates family members', async () => {
    const s = setup();
    await expect(s.addMember({ name: 'Laura', email: 'no-email', relation: 'partner', role: 'editor' })).rejects.toThrow('Invalid email');
    const m = await s.addMember({ name: 'Laura', email: 'laura@example.com', relation: 'partner', role: 'editor' });
    expect(m.status).toBe('local');
  });

  it('needsReset only applies to checked routines from an earlier day', () => {
    const base = { list: 'tomorrow', title: 'x', childId: null, done: true } as FamilyItem;
    expect(needsReset({ ...base, routine: true, doneAt: '2026-10-06T20:00:00' }, '2026-10-07')).toBe(true);
    expect(needsReset({ ...base, routine: false, doneAt: '2026-10-06T20:00:00' }, '2026-10-07')).toBe(false);
    expect(needsReset({ ...base, routine: true, doneAt: '2026-10-07T08:00:00' }, '2026-10-07')).toBe(false);
  });
});
