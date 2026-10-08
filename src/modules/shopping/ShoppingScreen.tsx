import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useDialog } from '@/components/feedback/DialogProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { accentPalette, useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';
import { CategoriesSheet } from './components/CategoriesSheet';
import { QuickAddItem } from './components/QuickAddItem';
import { ShoppingItemRow } from './components/ShoppingItemRow';
import { ShoppingItemSheet } from './components/ShoppingItemSheet';
import {
  useAddShoppingItem,
  useCategories,
  useClearBought,
  useCreateShoppingList,
  useDeleteShoppingList,
  useFrequentItems,
  useRemoveShoppingItem,
  useShoppingItems,
  useShoppingLists,
  useShoppingPeople,
  useToggleShoppingItem,
  useUpdateShoppingList,
} from './hooks';
import { shoppingMeta } from './meta';
import { BUILTIN_CATEGORIES, type ShoppingGrouping, type ShoppingItem } from './types';

interface Group {
  key: string;
  title: string;
  emoji?: string;
  color: string;
  items: ShoppingItem[];
}

/** Compras (separate module): lists, categories, stores and who each thing is for. */
export function ShoppingScreen() {
  const { t } = useTranslation();
  const { spacing, radius, colors } = useTheme();
  const { breakpoint } = useBreakpoint();
  const dialog = useDialog();
  const lists = useShoppingLists();
  const [selected, setSelected] = useState<string | null>(null);
  const listId = selected && lists.data?.some((l) => l.id === selected) ? selected : (lists.data?.[0]?.id ?? null);
  const list = lists.data?.find((l) => l.id === listId);
  const items = useShoppingItems(listId);
  const frequent = useFrequentItems(listId);
  const people = useShoppingPeople();
  const { byId } = useCategories();
  const toggle = useToggleShoppingItem();
  const remove = useRemoveShoppingItem();
  const clear = useClearBought();
  const addFrequent = useAddShoppingItem(true);
  const createList = useCreateShoppingList();
  const renameList = useUpdateShoppingList();
  const deleteList = useDeleteShoppingList();
  const [grouping, setGrouping] = useState<ShoppingGrouping>('category');
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [showBought, setShowBought] = useState(false);

  const personOf = useMemo(() => new Map((people.data ?? []).map((p) => [p.id, p])), [people.data]);
  const pending = useMemo(() => (items.data ?? []).filter((i) => !i.done), [items.data]);
  const bought = useMemo(() => (items.data ?? []).filter((i) => i.done), [items.data]);

  const groups: Group[] = useMemo(() => {
    if (grouping === 'none') return pending.length ? [{ key: 'all', title: '', color: shoppingMeta.accent, items: pending }] : [];
    const map = new Map<string, Group>();
    for (const i of pending) {
      let g: Omit<Group, 'items'>;
      if (grouping === 'category') {
        const c = i.categoryId ? byId.get(i.categoryId) : undefined;
        g = c
          ? { key: c.id, title: c.label, emoji: c.emoji, color: c.color }
          : { key: 'none', title: t('shopping.noCategory'), emoji: '🛒', color: colors.textSubtle };
      } else if (grouping === 'store') {
        g = i.store
          ? { key: `s:${i.store}`, title: i.store, emoji: '📍', color: shoppingMeta.accent }
          : { key: 'none', title: t('shopping.anyStore'), emoji: '🛒', color: colors.textSubtle };
      } else {
        const p = i.personId ? personOf.get(i.personId) : undefined;
        g = p
          ? { key: p.id, title: p.name, color: p.color }
          : { key: 'none', title: t('shopping.forHome'), emoji: '🏠', color: colors.textSubtle };
      }
      const cur = map.get(g.key) ?? { ...g, items: [] };
      cur.items.push(i);
      map.set(g.key, cur);
    }
    const order = new Map(BUILTIN_CATEGORIES.map((c, idx) => [c.id, idx]));
    return [...map.values()].sort((a, b) => {
      if (a.key === 'none') return 1;
      if (b.key === 'none') return -1;
      if (grouping === 'category') return (order.get(a.key) ?? 99) - (order.get(b.key) ?? 99) || a.title.localeCompare(b.title);
      return a.title.localeCompare(b.title);
    });
  }, [grouping, pending, byId, personOf, t, colors.textSubtle]);

  const newList = async () => {
    const name = await dialog.prompt({
      title: t('shopping.newList'),
      label: t('shopping.listName'),
      placeholder: t('shopping.listPlaceholder'),
      confirmLabel: t('common.create'),
    });
    if (name)
      createList.mutate(
        { name, color: accentPalette[(lists.data?.length ?? 0) % accentPalette.length] },
        { onSuccess: (l) => setSelected(l.id) },
      );
  };
  const renameCurrent = async () => {
    if (!list) return;
    const name = await dialog.prompt({
      title: t('shopping.renameList'),
      label: t('shopping.listName'),
      initialValue: list.name,
      confirmLabel: t('common.save'),
    });
    if (name && name !== list.name) renameList.mutate({ id: list.id, name });
  };
  const deleteCurrent = async () => {
    if (!list) return;
    const ok = await dialog.confirm({
      title: t('shopping.deleteListTitle', { name: list.name }),
      message: t('shopping.deleteListMessage'),
      confirmLabel: t('common.delete'),
      destructive: true,
    });
    if (ok) deleteList.mutate(list.id, { onSuccess: () => setSelected(null) });
  };

  const row = (i: ShoppingItem) => {
    const p = i.personId ? personOf.get(i.personId) : undefined;
    return (
      <ShoppingItemRow
        key={i.id}
        item={i}
        category={i.categoryId ? byId.get(i.categoryId) : undefined}
        personName={grouping === 'person' ? undefined : p?.name}
        personColor={p?.color}
        showStore={grouping !== 'store'}
        onToggle={() => toggle.mutate(i)}
        onEdit={() => setEditing(i)}
        onRemove={() => remove.mutate(i.id)}
      />
    );
  };

  const wide = breakpoint === 'expanded' || breakpoint === 'wide';
  const listTabs = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
      contentContainerStyle={{ gap: spacing.sm, alignItems: 'center' }}
    >
      {(lists.data ?? []).map((l) => {
        const active = l.id === listId;
        return (
          <Pressable
            key={l.id}
            onPress={() => setSelected(l.id)}
            accessibilityRole="tab"
            aria-selected={active}
            accessibilityLabel={l.name}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              paddingHorizontal: spacing.lg,
              minHeight: 38,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: active ? l.color : colors.border,
              backgroundColor: active ? withAlpha(l.color, 0.18) : 'transparent',
            }}
          >
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: l.color }} />
            <AppText variant="bodyStrong" tone={active ? 'text' : 'textMuted'}>
              {l.name}
            </AppText>
          </Pressable>
        );
      })}
      <IconButton icon="plus" label={t('shopping.newList')} onPress={() => void newList()} />
    </ScrollView>
  );

  const addCard = listId ? (
    <Card>
      <QuickAddItem listId={listId} />
      {frequent.data?.length ? (
        <View style={{ gap: spacing.xs, marginTop: spacing.md }}>
          <AppText variant="overline" tone="textMuted">
            {t('shopping.buyAgain')}
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {frequent.data.map((f) => {
              const c = f.categoryId ? byId.get(f.categoryId) : undefined;
              return (
                <Button
                  key={f.title}
                  label={`${c?.emoji ?? '+'} ${f.title}`}
                  size="sm"
                  variant="secondary"
                  onPress={() => addFrequent.mutate({ listId, title: f.title, categoryId: f.categoryId })}
                />
              );
            })}
          </View>
        </View>
      ) : null}
    </Card>
  ) : null;

  const listCard = (
    <Card padded={false} style={{ padding: spacing.md, gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
        <AppText variant="heading" style={{ flex: 1 }}>
          {t('shopping.toBuy', { count: pending.length })}
        </AppText>
        <SegmentedControl<ShoppingGrouping>
          accessibilityLabel={t('shopping.groupBy')}
          value={grouping}
          onChange={setGrouping}
          options={[
            { value: 'category', label: t('shopping.by.category'), icon: 'tag' },
            { value: 'store', label: t('shopping.by.store'), icon: 'map-pin' },
            { value: 'person', label: t('shopping.by.person'), icon: 'users' },
            { value: 'none', label: t('shopping.by.none'), icon: 'list' },
          ]}
        />
      </View>
      {items.isLoading ? (
        <LoadingState />
      ) : !pending.length ? (
        <EmptyState
          compact
          icon="shopping-cart"
          accent={shoppingMeta.accent}
          title={t('shopping.empty')}
          description={t('shopping.emptyHint')}
        />
      ) : (
        groups.map((g) => (
          <View key={g.key} style={{ borderLeftWidth: 4, borderLeftColor: g.color, borderRadius: 0, paddingLeft: spacing.sm }}>
            {g.title ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs }}>
                {g.emoji ? (
                  <AppText variant="body">{g.emoji}</AppText>
                ) : (
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: g.color }} />
                )}
                <AppText variant="smallStrong" style={{ flex: 1 }} accessibilityRole="header">
                  {g.title}
                </AppText>
                <AppText variant="caption" tone="textSubtle">
                  {g.items.length}
                </AppText>
              </View>
            ) : null}
            {g.items.map(row)}
          </View>
        ))
      )}
      {bought.length ? (
        <View style={{ gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Pressable
              onPress={() => setShowBought(!showBought)}
              accessibilityRole="button"
              aria-expanded={showBought}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 36 }}
            >
              <Icon name={showBought ? 'chevron-down' : 'chevron-right'} size={16} color={colors.textMuted} />
              <AppText variant="smallStrong" tone="textMuted">
                {t('shopping.boughtCount', { count: bought.length })}
              </AppText>
            </Pressable>
            <Button
              label={t('shopping.clearBought')}
              icon="check-circle"
              size="sm"
              variant="ghost"
              onPress={() => listId && clear.mutate(listId)}
            />
          </View>
          {showBought ? bought.map(row) : null}
        </View>
      ) : null}
    </Card>
  );

  return (
    <Screen>
      <PageHeader
        title={t('modules.shopping.title')}
        subtitle={t('shopping.subtitle')}
        icon={shoppingMeta.icon}
        accent={shoppingMeta.accent}
        actions={
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            <Button
              label={t('shopping.categoriesButton')}
              icon="tag"
              variant="secondary"
              size="sm"
              onPress={() => setCategoriesOpen(true)}
            />
            {list ? <IconButton icon="edit-2" label={t('shopping.renameList')} onPress={() => void renameCurrent()} /> : null}
            {(lists.data?.length ?? 0) > 1 ? (
              <IconButton icon="trash-2" label={t('shopping.deleteList')} onPress={() => void deleteCurrent()} />
            ) : null}
          </View>
        }
      />
      {lists.isLoading ? <LoadingState /> : listTabs}
      {wide ? (
        <View style={{ flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' }}>
          <View style={{ width: 380 }}>{addCard}</View>
          <View style={{ flex: 1, minWidth: 0 }}>{listCard}</View>
        </View>
      ) : (
        <>
          {addCard}
          {listCard}
        </>
      )}
      <ShoppingItemSheet item={editing} onClose={() => setEditing(null)} />
      <CategoriesSheet visible={categoriesOpen} onClose={() => setCategoriesOpen(false)} />
    </Screen>
  );
}
