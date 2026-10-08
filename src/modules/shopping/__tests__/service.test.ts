import { createServices } from '@/services/container';
import { LocalRepository } from '@/storage/repository';
import { memoryStore } from '@/test/memoryStore';
import type { FamilyItem } from '@/modules/family/types';
import { parseShoppingInput, ShoppingService } from '../service';
import type { ShoppingCategory, ShoppingItem, ShoppingList } from '../types';

// jest.mock factories run lazily and must use require().
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
let mockId = 0;
jest.mock('@/utils/id', () => ({ createId: () => `id-${++mockId}` }));

function setup() {
  const kv = memoryStore();
  const repo = <T extends { id: string }>(c: string) => new LocalRepository<T & never>(kv, 'u', c);
  const legacy = new LocalRepository<FamilyItem>(kv, 'u', 'familyItems');
  return {
    s: new ShoppingService(
      repo<ShoppingList>('shoppingLists'),
      repo<ShoppingItem>('shoppingItems'),
      repo<ShoppingCategory>('shoppingCategories'),
      legacy,
    ),
    legacy,
  };
}

const cats = [
  { id: 'dairy', name: 'Lácteos y huevos' },
  { id: 'baby', name: 'Bebé' },
];

describe('parseShoppingInput', () => {
  it('reads quantity, #category and @store', () => {
    expect(parseShoppingInput('2 leche #lacteos @mercadona', cats)).toEqual({
      title: 'Leche',
      quantity: '2',
      categoryId: 'dairy',
      store: 'Mercadona',
    });
    expect(parseShoppingInput('pañales x3 #bebé', cats)).toEqual({ title: 'Pañales', quantity: '3', categoryId: 'baby' });
    expect(parseShoppingInput('500g queso', cats)).toEqual({ title: 'Queso', quantity: '500g' });
    expect(parseShoppingInput('pan #desconocida', cats).title).toBe('Pan #desconocida');
  });
});

describe('ShoppingService', () => {
  it('creates a default list and migrates the old Familia shopping list', async () => {
    const { s, legacy } = setup();
    await legacy.create({ list: 'shopping', title: 'Pañales', childId: 'kid', category: 'baby', store: 'Farmacia', done: false } as never);
    await legacy.create({ list: 'tomorrow', title: 'Mochila', childId: 'kid', done: false } as never);
    const [main] = await s.listLists('Compra');
    expect(main.name).toBe('Compra');
    const items = await s.listItems(main.id);
    expect(items.map((i) => [i.title, i.categoryId, i.store, i.personId])).toEqual([['Pañales', 'baby', 'Farmacia', 'kid']]);
    expect((await legacy.list()).map((i) => i.title)).toEqual(['Mochila']); // "para mañana" stays in Familia
  });

  it('avoids duplicates, remembers categories and suggests frequent items', async () => {
    const { s } = setup();
    const [list] = await s.listLists();
    const milk = await s.addItem({ listId: list.id, title: 'Leche', categoryId: 'dairy' });
    await s.addItem({ listId: list.id, title: 'leche', quantity: '6' });
    expect(await s.listItems(list.id)).toHaveLength(1);
    await s.toggleItem((await s.listItems(list.id))[0]);
    expect(await s.clearBought(list.id)).toBe(1);
    expect(await s.listItems(list.id)).toHaveLength(0);
    expect((await s.frequentItems(list.id)).map((f) => f.title)).toEqual(['Leche']);
    // Re-adding later reuses the category it had.
    const again = await s.addItem({ listId: list.id, title: 'LECHE' });
    expect(again.categoryId).toBe('dairy');
    expect(again.id).not.toBe(milk.id);
    expect(await s.frequentItems(list.id)).toHaveLength(0); // pending now
  });

  it('keeps at least one list and moves items of a deleted custom category to none', async () => {
    const { s } = setup();
    const [main] = await s.listLists();
    await expect(s.deleteList(main.id)).rejects.toThrow('last-list');
    const pharmacy = await s.createList('Farmacia', '#E11D48');
    await s.addItem({ listId: pharmacy.id, title: 'Ibuprofeno' });
    await s.deleteList(pharmacy.id);
    expect(await s.listItems()).toHaveLength(0);
    const cat = await s.createCategory('Cumpleaños', '🎈', '#EC4899');
    const item = await s.addItem({ listId: main.id, title: 'Globos', categoryId: cat.id });
    await s.deleteCategory(cat.id);
    expect((await s.listItems()).find((i) => i.id === item.id)?.categoryId).toBeNull();
  });

  it('drops extra empty "Compra" lists (joining a family / new device) but never lists in use', async () => {
    const s = createServices('u', memoryStore(), null);
    const [mine] = await s.shopping.listLists('Compra');
    expect(mine.auto).toBe(true);
    // The family's list arrives later with items.
    const family = await s.collections.get('shoppingLists')!.importRows([
      {
        id: 'fam',
        ownerId: 'david',
        name: 'Compra',
        color: '#0D9488',
        order: 0,
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
        deletedAt: null,
      } as never,
    ]);
    expect(family).toBe(1);
    await s.shopping.addItem({ listId: 'fam', title: 'Leche' });
    const lists = await s.shopping.listLists('Compra');
    expect(lists.map((l) => l.id)).toEqual(['fam']);
    // Other lists are never touched, even empty; nor is the only default list.
    const party = await s.shopping.createList('Cumple', '#f00');
    expect((await s.shopping.listLists('Compra')).map((l) => l.id)).toEqual(['fam', party.id]);
  });

  it('keeps your only (empty) default list even when another list has items', async () => {
    const s = createServices('u2', memoryStore(), null);
    const [compra] = await s.shopping.listLists('Compra');
    const farmacia = await s.shopping.createList('Farmacia', '#f00');
    await s.shopping.addItem({ listId: farmacia.id, title: 'Ibuprofeno' });
    expect((await s.shopping.listLists('Compra')).map((l) => l.id)).toEqual([compra.id, farmacia.id]);
  });
});
