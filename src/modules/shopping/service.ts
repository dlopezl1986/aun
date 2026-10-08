import type { FamilyItem } from '@/modules/family/types';
import type { Repository } from '@/storage/repository';
import { matchScore, normalizeSearch, type SearchResult } from '@/types/search';
import { BUILTIN_CATEGORIES, type ShoppingCategory, type ShoppingItem, type ShoppingList } from './types';

export interface ItemInput {
  listId: string;
  title: string;
  quantity?: string | null;
  categoryId?: string | null;
  store?: string | null;
  personId?: string | null;
  notes?: string | null;
}

const clean = (v: string | null | undefined) => v?.trim() || null;

/** Old Familia shopping categories → new built-in ids. */
const LEGACY_CATEGORY: Record<string, string> = {
  food: 'pantry',
  cleaning: 'cleaning',
  hygiene: 'hygiene',
  baby: 'baby',
  pharmacy: 'pharmacy',
  clothes: 'clothes',
  school: 'school',
  home: 'home',
  other: 'other',
};

export interface ParsedItem {
  title: string;
  quantity?: string;
  categoryId?: string;
  store?: string;
}

/**
 * Quick capture: "2 leche #lácteos @mercadona", "pañales x3 #bebé".
 *  - leading number ("2", "1,5", "500g") or "x3"/"3x" → quantity
 *  - #categoría → category (name match, accent/case-insensitive)
 *  - @tienda → store (single word; use the editor for longer names)
 */
export function parseShoppingInput(input: string, categories: { id: string; name: string }[]): ParsedItem {
  let text = ` ${input.trim()} `;
  const out: ParsedItem = { title: '' };
  text = text.replace(/\s#([\p{L}\p{N}_-]+)(?=\s)/gu, (all, word: string) => {
    const q = normalizeSearch(word);
    const hit = categories.find((c) => normalizeSearch(c.name).startsWith(q));
    if (!hit) return all;
    out.categoryId = hit.id;
    return ' ';
  });
  text = text.replace(/\s@([\p{L}\p{N}_.-]+)(?=\s)/gu, (_all, word: string) => {
    out.store = word.charAt(0).toUpperCase() + word.slice(1);
    return ' ';
  });
  text = text.replace(/\s(?:x\s?(\d+)|(\d+)\s?x)(?=\s)/i, (_all, a?: string, b?: string) => {
    out.quantity = a ?? b;
    return ' ';
  });
  const lead = text.match(/^\s(\d+(?:[.,]\d+)?\s?(?:kg|g|l|ml|uds?|paquetes?|botes?|latas?|docenas?)?)\s(?=\S)/i);
  if (lead && !out.quantity) {
    out.quantity = lead[1].trim();
    text = text.slice(lead[0].length - 1);
  }
  out.title = text.replace(/\s+/g, ' ').trim();
  if (out.title) out.title = out.title.charAt(0).toUpperCase() + out.title.slice(1);
  return out;
}

/**
 * "Compras": several lists, built-in + custom categories, stores, people,
 * history of bought items for one-tap re-adding.
 */
export class ShoppingService {
  private migrated = false;

  constructor(
    private readonly lists: Repository<ShoppingList>,
    private readonly items: Repository<ShoppingItem>,
    private readonly categories: Repository<ShoppingCategory>,
    private readonly legacyFamilyItems: Repository<FamilyItem>,
  ) {}

  // ---------- Lists ----------

  /** Lists in order; creates the default one ("Compra") the first time. */
  async listLists(defaultName = 'Compra'): Promise<ShoppingList[]> {
    let all = (await this.lists.list()).sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
    if (!all.length) {
      all = [await this.lists.create({ name: defaultName, color: '#16A34A', order: 0 })];
    }
    await this.migrateLegacy(all[0].id);
    return all;
  }

  async createList(name: string, color: string): Promise<ShoppingList> {
    const n = name.trim();
    if (!n) throw new Error('Name is required');
    const count = (await this.lists.list()).length;
    return this.lists.create({ name: n, color, order: count });
  }

  updateList(id: string, patch: Partial<Pick<ShoppingList, 'name' | 'color'>>): Promise<ShoppingList> {
    if (patch.name !== undefined && !patch.name.trim()) throw new Error('Name is required');
    return this.lists.update(id, { ...patch, ...(patch.name ? { name: patch.name.trim() } : {}) });
  }

  /** Deletes a list and its items. The last list cannot be deleted. */
  async deleteList(id: string): Promise<void> {
    if ((await this.lists.list()).length <= 1) throw new Error('last-list');
    const ids = (await this.items.list()).filter((i) => i.listId === id).map((i) => i.id);
    await this.items.removeMany(ids);
    await this.lists.remove(id);
  }

  // ---------- Categories ----------

  listCustomCategories(): Promise<ShoppingCategory[]> {
    return this.categories.list();
  }

  async createCategory(name: string, emoji: string, color: string): Promise<ShoppingCategory> {
    const n = name.trim();
    if (!n) throw new Error('Name is required');
    return this.categories.create({ name: n, emoji: emoji.trim() || '🏷️', color });
  }

  /** Deleting a custom category leaves its items without category. */
  async deleteCategory(id: string): Promise<void> {
    for (const i of (await this.items.list()).filter((x) => x.categoryId === id)) await this.items.update(i.id, { categoryId: null });
    await this.categories.remove(id);
  }

  // ---------- Items ----------

  /** Pending first, then bought (not yet cleared), each in creation order. */
  async listItems(listId?: string): Promise<ShoppingItem[]> {
    return (await this.items.list())
      .filter((i) => !i.archivedAt && (!listId || i.listId === listId))
      .sort((a, b) => Number(a.done) - Number(b.done) || a.createdAt.localeCompare(b.createdAt));
  }

  async addItem(input: ItemInput): Promise<ShoppingItem> {
    const title = input.title.trim();
    if (!title) throw new Error('Title is required');
    // Adding something already pending in the list just updates it (no duplicates).
    const dup = (await this.listItems(input.listId)).find((i) => !i.done && normalizeSearch(i.title) === normalizeSearch(title));
    if (dup) return this.items.update(dup.id, { quantity: clean(input.quantity) ?? dup.quantity ?? null });
    return this.items.create({
      listId: input.listId,
      title,
      quantity: clean(input.quantity),
      categoryId: input.categoryId ?? (await this.lastCategoryFor(title)),
      store: clean(input.store),
      personId: input.personId ?? null,
      notes: clean(input.notes),
      done: false,
      doneAt: null,
      archivedAt: null,
    });
  }

  /** Remembers the category last used for the same product. */
  private async lastCategoryFor(title: string): Promise<string | null> {
    const key = normalizeSearch(title);
    const prev = (await this.items.list())
      .filter((i) => i.categoryId && normalizeSearch(i.title) === key)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    return prev?.categoryId ?? null;
  }

  updateItem(id: string, patch: Partial<ItemInput>): Promise<ShoppingItem> {
    const p: Partial<ShoppingItem> = { ...patch };
    if (patch.title !== undefined) {
      if (!patch.title.trim()) throw new Error('Title is required');
      p.title = patch.title.trim();
    }
    for (const k of ['quantity', 'store', 'notes'] as const) if (k in patch) p[k] = clean(patch[k]);
    return this.items.update(id, p);
  }

  toggleItem(item: ShoppingItem): Promise<ShoppingItem> {
    const done = !item.done;
    return this.items.update(item.id, { done, doneAt: done ? new Date().toISOString() : null });
  }

  removeItem(id: string): Promise<void> {
    return this.items.remove(id);
  }

  /** "Vaciar comprados": hides bought items (kept as history for suggestions). */
  async clearBought(listId: string): Promise<number> {
    const bought = (await this.listItems(listId)).filter((i) => i.done);
    const stamp = new Date().toISOString();
    for (const i of bought) await this.items.update(i.id, { archivedAt: stamp });
    return bought.length;
  }

  /** Most bought products not currently pending in the list ("Volver a comprar"). */
  async frequentItems(listId: string, limit = 12): Promise<{ title: string; categoryId: string | null; count: number }[]> {
    const all = await this.items.list();
    const pending = new Set(all.filter((i) => i.listId === listId && !i.done && !i.archivedAt).map((i) => normalizeSearch(i.title)));
    const counts = new Map<string, { title: string; categoryId: string | null; count: number }>();
    for (const i of all) {
      if (!i.done && !i.archivedAt) continue;
      const key = normalizeSearch(i.title);
      if (pending.has(key)) continue;
      const c = counts.get(key) ?? { title: i.title, categoryId: i.categoryId ?? null, count: 0 };
      c.count += 1;
      counts.set(key, c);
    }
    return [...counts.values()].sort((a, b) => b.count - a.count || a.title.localeCompare(b.title)).slice(0, limit);
  }

  async knownStores(): Promise<string[]> {
    const counts = new Map<string, number>();
    for (const i of await this.items.list()) if (i.store) counts.set(i.store, (counts.get(i.store) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
  }

  // ---------- Migration from Familia (shopping used to live there) ----------

  private async migrateLegacy(listId: string): Promise<void> {
    if (this.migrated) return;
    this.migrated = true;
    const legacy = (await this.legacyFamilyItems.list()).filter((i) => i.list === 'shopping');
    for (const old of legacy) {
      await this.items.create({
        listId,
        title: old.title,
        quantity: old.quantity ?? null,
        categoryId: old.category ? (LEGACY_CATEGORY[old.category] ?? 'other') : null,
        store: old.store ?? null,
        personId: old.childId,
        notes: null,
        done: old.done,
        doneAt: old.doneAt ?? null,
        archivedAt: null,
      });
    }
    await this.legacyFamilyItems.removeMany(legacy.map((i) => i.id));
  }

  // ---------- Search ----------

  async search(text: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    for (const i of await this.listItems()) {
      const score = matchScore(i.title, text);
      if (!score) continue;
      results.push({
        ref: { module: 'shopping', type: 'item', id: i.id },
        title: i.quantity ? `${i.title} · ${i.quantity}` : i.title,
        kindKey: 'search.kinds.shoppingItem',
        subtitle: i.store ?? undefined,
        score: score + (i.done ? 0 : 1),
        route: '/shopping',
      });
    }
    return results;
  }
}

export const builtinCategoryIds = new Set(BUILTIN_CATEGORIES.map((c) => c.id));
