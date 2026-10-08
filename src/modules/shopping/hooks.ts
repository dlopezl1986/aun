import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useDataMutation, useDataQuery } from '@/state/queryClient';
import type { ItemInput } from './service';
import { BUILTIN_CATEGORIES, type CategoryInfo, type ShoppingItem } from './types';

export function useShoppingLists() {
  const { t } = useTranslation();
  return useDataQuery('shopping', ['lists'], (s) => s.shopping.listLists(t('shopping.defaultList')));
}

export function useShoppingItems(listId: string | null) {
  return useDataQuery('shopping', ['items', listId], (s) => (listId ? s.shopping.listItems(listId) : Promise.resolve([])));
}

/** All pending items of every list (dashboard). */
export function useAllShoppingItems() {
  return useDataQuery('shopping', ['items', 'all'], async (s) => {
    await s.shopping.listLists();
    return s.shopping.listItems();
  });
}

export function useFrequentItems(listId: string | null) {
  return useDataQuery('shopping', ['frequent', listId], (s) => (listId ? s.shopping.frequentItems(listId) : Promise.resolve([])));
}

export function useShoppingStores() {
  return useDataQuery('shopping', ['stores'], (s) => s.shopping.knownStores());
}

/** Family members (for "¿para quién?"), read through the shared services. */
export function useShoppingPeople() {
  return useDataQuery('family', ['children'], (s) => s.family.listChildren());
}

/** Built-in + custom categories with display names. */
export function useCategories(): { categories: (CategoryInfo & { label: string })[]; byId: Map<string, CategoryInfo & { label: string }> } {
  const { t } = useTranslation();
  const custom = useDataQuery('shopping', ['categories'], (s) => s.shopping.listCustomCategories());
  return useMemo(() => {
    const categories = [
      ...BUILTIN_CATEGORIES.map((c) => ({ ...c, label: t(c.nameKey!) })),
      ...(custom.data ?? []).map((c) => ({ id: c.id, name: c.name, emoji: c.emoji, color: c.color, builtin: false, label: c.name })),
    ];
    return { categories, byId: new Map(categories.map((c) => [c.id, c])) };
  }, [custom.data, t]);
}

export function useAddShoppingItem(silent = false) {
  const { t } = useTranslation();
  return useDataMutation((s, input: ItemInput) => s.shopping.addItem(input), {
    invalidate: ['shopping'],
    successMessage: silent ? undefined : (i) => t('shopping.toast.added', { title: i.title }),
  });
}

export function useUpdateShoppingItem() {
  const { t } = useTranslation();
  return useDataMutation((s, v: { id: string; patch: Partial<ItemInput> }) => s.shopping.updateItem(v.id, v.patch), {
    invalidate: ['shopping'],
    successMessage: t('common.saved'),
  });
}

export function useToggleShoppingItem() {
  return useDataMutation((s, item: ShoppingItem) => s.shopping.toggleItem(item), { invalidate: ['shopping'] });
}

export function useRemoveShoppingItem() {
  return useDataMutation((s, id: string) => s.shopping.removeItem(id), { invalidate: ['shopping'] });
}

export function useClearBought() {
  const { t } = useTranslation();
  return useDataMutation((s, listId: string) => s.shopping.clearBought(listId), {
    invalidate: ['shopping'],
    successMessage: (n) => t('shopping.toast.cleared', { count: n }),
  });
}

export function useCreateShoppingList() {
  const { t } = useTranslation();
  return useDataMutation((s, v: { name: string; color: string }) => s.shopping.createList(v.name, v.color), {
    invalidate: ['shopping'],
    successMessage: t('shopping.toast.listCreated'),
  });
}

export function useUpdateShoppingList() {
  return useDataMutation((s, v: { id: string; name: string }) => s.shopping.updateList(v.id, { name: v.name }), {
    invalidate: ['shopping'],
  });
}

export function useDeleteShoppingList() {
  const { t } = useTranslation();
  return useDataMutation((s, id: string) => s.shopping.deleteList(id), {
    invalidate: ['shopping'],
    successMessage: t('shopping.toast.listDeleted'),
    errorMessage: (e) => (e instanceof Error && e.message === 'last-list' ? t('shopping.errors.lastList') : t('common.errorDescription')),
  });
}

export function useCreateCategory() {
  const { t } = useTranslation();
  return useDataMutation((s, v: { name: string; emoji: string; color: string }) => s.shopping.createCategory(v.name, v.emoji, v.color), {
    invalidate: ['shopping'],
    successMessage: t('shopping.toast.categoryCreated'),
  });
}

export function useDeleteCategory() {
  return useDataMutation((s, id: string) => s.shopping.deleteCategory(id), { invalidate: ['shopping'] });
}
