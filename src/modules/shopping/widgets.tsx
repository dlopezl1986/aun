import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ChipGroup } from '@/components/forms/Chips';
import { AppText } from '@/components/ui/AppText';
import { Card, CardHeader } from '@/components/ui/Card';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { StatTile } from '@/modules/dashboard/components/StatTile';
import { SummaryTile } from '@/modules/dashboard/components/SummaryTile';
import { useTheme } from '@/theme';
import { QuickAddItem } from './components/QuickAddItem';
import { useAllShoppingItems, useCategories, useShoppingLists } from './hooks';
import { shoppingMeta } from './meta';

const openShopping = () => router.navigate('/shopping');

/** "Lista de la compra" on Inicio: what is pending, grouped by category. */
export function ShoppingWidget() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const items = useAllShoppingItems();
  const { byId } = useCategories();
  const pending = (items.data ?? []).filter((i) => !i.done);
  return (
    <Card style={{ flex: 1 }}>
      <CardHeader
        title={t('shopping.widget.title')}
        icon={shoppingMeta.icon}
        accent={shoppingMeta.accent}
        actionLabel={t('common.open')}
        onAction={openShopping}
      />
      {items.isLoading ? (
        <LoadingState />
      ) : !pending.length ? (
        <EmptyState
          compact
          icon="shopping-cart"
          accent={shoppingMeta.accent}
          title={t('shopping.empty')}
          actionLabel={t('shopping.widget.add')}
          onAction={openShopping}
        />
      ) : (
        <View style={{ gap: spacing.xs }}>
          {pending.slice(0, 7).map((i) => {
            const c = i.categoryId ? byId.get(i.categoryId) : undefined;
            return (
              <View key={i.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 28 }}>
                <AppText variant="body">{c?.emoji ?? '🛒'}</AppText>
                <AppText variant="body" numberOfLines={1} style={{ flex: 1 }}>
                  {i.title}
                </AppText>
                {i.quantity ? (
                  <AppText variant="caption" tone="textMuted">
                    {i.quantity}
                  </AppText>
                ) : null}
              </View>
            );
          })}
          {pending.length > 7 ? (
            <AppText variant="caption" tone="textSubtle">
              {t('shopping.widget.more', { count: pending.length - 7 })}
            </AppText>
          ) : null}
        </View>
      )}
    </Card>
  );
}

export function ShoppingTodaySummary() {
  const { t } = useTranslation();
  const items = useAllShoppingItems();
  const pending = (items.data ?? []).filter((i) => !i.done);
  return (
    <SummaryTile
      icon={shoppingMeta.icon}
      accent={shoppingMeta.accent}
      label={t('modules.shopping.title')}
      loading={items.isLoading}
      value={pending.length ? t('shopping.summary.pending', { count: pending.length }) : t('shopping.summary.none')}
      details={pending.slice(0, 2).map((i) => i.title)}
      onPress={openShopping}
    />
  );
}

export function ShoppingWeeklyStats() {
  const { t } = useTranslation();
  const items = useAllShoppingItems();
  return (
    <StatTile
      icon="shopping-cart"
      accent={shoppingMeta.accent}
      value={(items.data ?? []).filter((i) => !i.done).length}
      label={t('shopping.stats.toBuy')}
      loading={items.isLoading}
    />
  );
}

/** Quick action from Inicio: add to a list without leaving the dashboard. */
function QuickForm({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const lists = useShoppingLists();
  const [listId, setListId] = useState<string | null>(null);
  const current = useMemo(() => listId ?? lists.data?.[0]?.id ?? null, [listId, lists.data]);
  return (
    <Sheet visible onClose={onClose} title={t('shopping.quick.title')}>
      {(lists.data?.length ?? 0) > 1 ? (
        <View style={{ gap: spacing.xs }}>
          <ChipGroup<string>
            accessibilityLabel={t('shopping.fields.list')}
            selected={current ?? ''}
            onToggle={setListId}
            options={(lists.data ?? []).map((l) => ({ value: l.id, label: l.name }))}
          />
        </View>
      ) : null}
      {current ? <QuickAddItem listId={current} autoFocus showCategories onAdded={onClose} /> : <LoadingState />}
    </Sheet>
  );
}

export function QuickShoppingSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return visible ? <QuickForm onClose={onClose} /> : null;
}
