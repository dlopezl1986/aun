import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ChipGroup } from '@/components/forms/Chips';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { TextField } from '@/components/ui/TextField';
import { useTheme } from '@/theme';
import {
  useCategories,
  useRemoveShoppingItem,
  useShoppingLists,
  useShoppingPeople,
  useShoppingStores,
  useUpdateShoppingItem,
} from '../hooks';
import type { ShoppingItem } from '../types';
import { CategoryChips } from './CategoryChips';

function Label({ children }: { children: string }) {
  return (
    <AppText variant="smallStrong" tone="textMuted">
      {children}
    </AppText>
  );
}

function Editor({ item, onClose }: { item: ShoppingItem; onClose: () => void }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { categories } = useCategories();
  const lists = useShoppingLists();
  const stores = useShoppingStores();
  const people = useShoppingPeople();
  const update = useUpdateShoppingItem();
  const remove = useRemoveShoppingItem();
  const [title, setTitle] = useState(item.title);
  const [quantity, setQuantity] = useState(item.quantity ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(item.categoryId ?? null);
  const [store, setStore] = useState(item.store ?? '');
  const [personId, setPersonId] = useState<string | null>(item.personId ?? null);
  const [notes, setNotes] = useState(item.notes ?? '');
  const [listId, setListId] = useState(item.listId);

  const save = () => {
    if (!title.trim()) return;
    update.mutate({ id: item.id, patch: { title, quantity, categoryId, store, personId, notes, listId } }, { onSuccess: onClose });
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={t('shopping.edit')}
      footer={
        <>
          <Button
            label={t('common.delete')}
            icon="trash-2"
            variant="ghost"
            onPress={() => remove.mutate(item.id, { onSuccess: onClose })}
          />
          <View style={{ flex: 1 }} />
          <Button label={t('common.cancel')} variant="ghost" onPress={onClose} />
          <Button label={t('common.save')} onPress={save} disabled={!title.trim()} loading={update.isPending} />
        </>
      }
    >
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 2 }}>
          <TextField label={t('shopping.fields.title')} value={title} onChangeText={setTitle} onSubmitEditing={save} />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label={t('shopping.fields.quantity')} value={quantity} onChangeText={setQuantity} placeholder="2, 1 kg…" />
        </View>
      </View>
      <View style={{ gap: spacing.sm }}>
        <Label>{t('shopping.fields.category')}</Label>
        <CategoryChips
          categories={categories}
          value={categoryId}
          onChange={setCategoryId}
          accessibilityLabel={t('shopping.fields.category')}
        />
      </View>
      <View style={{ gap: spacing.sm }}>
        <TextField
          label={t('shopping.fields.store')}
          value={store}
          onChangeText={setStore}
          leftIcon="map-pin"
          placeholder={t('shopping.fields.storePlaceholder')}
        />
        {stores.data?.length ? (
          <ChipGroup<string>
            compact
            accessibilityLabel={t('shopping.fields.store')}
            selected={store}
            onToggle={(v) => setStore(v === store ? '' : v)}
            options={stores.data.slice(0, 8).map((s) => ({ value: s, label: s }))}
          />
        ) : null}
      </View>
      {people.data?.length ? (
        <View style={{ gap: spacing.sm }}>
          <Label>{t('shopping.fields.person')}</Label>
          <ChipGroup<string>
            accessibilityLabel={t('shopping.fields.person')}
            selected={personId ?? 'none'}
            onToggle={(v) => setPersonId(v === 'none' ? null : v)}
            options={[{ value: 'none', label: t('shopping.fields.everyone') }, ...people.data.map((p) => ({ value: p.id, label: p.name }))]}
          />
        </View>
      ) : null}
      {(lists.data?.length ?? 0) > 1 ? (
        <View style={{ gap: spacing.sm }}>
          <Label>{t('shopping.fields.list')}</Label>
          <ChipGroup<string>
            accessibilityLabel={t('shopping.fields.list')}
            selected={listId}
            onToggle={setListId}
            options={(lists.data ?? []).map((l) => ({ value: l.id, label: l.name }))}
          />
        </View>
      ) : null}
      <TextField
        label={t('shopping.fields.notes')}
        value={notes}
        onChangeText={setNotes}
        placeholder={t('shopping.fields.notesPlaceholder')}
        multiline
      />
    </Sheet>
  );
}

export function ShoppingItemSheet({ item, onClose }: { item: ShoppingItem | null; onClose: () => void }) {
  return item ? <Editor key={item.id} item={item} onClose={onClose} /> : null;
}
