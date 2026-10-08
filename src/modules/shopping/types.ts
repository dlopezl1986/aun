import type { BaseEntity } from '@/types/entity';

/** A shopping list ("Semanal", "Farmacia", "Cumpleaños de Elisa"…). */
export interface ShoppingList extends BaseEntity {
  name: string;
  color: string;
  order: number;
  /** Created automatically as the first list (may be merged away when joining a family). */
  auto?: boolean;
}

/** A user-made category (the built-in ones live in BUILTIN_CATEGORIES). */
export interface ShoppingCategory extends BaseEntity {
  name: string;
  emoji: string;
  color: string;
}

export interface ShoppingItem extends BaseEntity {
  listId: string;
  title: string;
  quantity?: string | null;
  /** Built-in key ("dairy") or the id of a custom category. */
  categoryId?: string | null;
  store?: string | null;
  /** Family member it is for (optional). */
  personId?: string | null;
  notes?: string | null;
  done: boolean;
  doneAt?: string | null;
  /** Bought and cleared: hidden from the list, kept for "frecuentes". */
  archivedAt?: string | null;
}

export interface CategoryInfo {
  id: string;
  /** Translation key for built-ins, literal name for custom ones. */
  nameKey?: string;
  name?: string;
  emoji: string;
  color: string;
  builtin: boolean;
}

/** Supermarket-aisle order: grouping by category follows a real shopping route. */
export const BUILTIN_CATEGORIES: CategoryInfo[] = [
  { id: 'produce', emoji: '🍎', color: '#16A34A' },
  { id: 'bakery', emoji: '🥖', color: '#B45309' },
  { id: 'meat', emoji: '🥩', color: '#DC2626' },
  { id: 'dairy', emoji: '🥛', color: '#0284C7' },
  { id: 'pantry', emoji: '🥫', color: '#CA8A04' },
  { id: 'frozen', emoji: '🧊', color: '#0891B2' },
  { id: 'drinks', emoji: '🥤', color: '#7C3AED' },
  { id: 'snacks', emoji: '🍫', color: '#9A3412' },
  { id: 'cleaning', emoji: '🧽', color: '#0D9488' },
  { id: 'hygiene', emoji: '🧴', color: '#DB2777' },
  { id: 'baby', emoji: '👶', color: '#F472B6' },
  { id: 'pharmacy', emoji: '💊', color: '#E11D48' },
  { id: 'pets', emoji: '🐾', color: '#A16207' },
  { id: 'home', emoji: '🏠', color: '#475569' },
  { id: 'clothes', emoji: '👕', color: '#4F46E5' },
  { id: 'school', emoji: '✏️', color: '#2563EB' },
  { id: 'other', emoji: '📦', color: '#64748B' },
].map((c) => ({ ...c, nameKey: `shopping.categories.${c.id}`, builtin: true }));

export type ShoppingGrouping = 'category' | 'store' | 'person' | 'none';
