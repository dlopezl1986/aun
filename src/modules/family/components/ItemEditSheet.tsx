import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { ChipGroup } from '@/components/forms/Chips';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { TextField } from '@/components/ui/TextField';
import { Toggle } from '@/components/ui/Toggle';
import { useTheme } from '@/theme';
import { useKnownStores, useRemoveFamilyItem, useUpdateFamilyItem } from '../hooks';
import { SHOPPING_CATEGORIES, type FamilyItem } from '../types';
import { PersonPicker, usePeople } from './PersonPicker';

/** Known category keys are translated; custom ones are shown as typed. */
export function categoryLabel(t: TFunction, value: string | null | undefined): string {
  if (!value) return t('family.categories.none');
  return (SHOPPING_CATEGORIES as readonly string[]).includes(value) ? t(`family.categories.${value}`) : value;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="smallStrong" tone="textMuted">
        {title}
      </AppText>
      {children}
    </View>
  );
}

function Editor({ item, onClose }: { item: FamilyItem; onClose: () => void }) {
  const { t } = useTranslation();
  const { people } = usePeople();
  const stores = useKnownStores();
  const update = useUpdateFamilyItem();
  const remove = useRemoveFamilyItem();
  const [title, setTitle] = useState(item.title);
  const [childId, setChildId] = useState<string | null>(item.childId);
  const [category, setCategory] = useState<string | null>(item.category ?? null);
  const [store, setStore] = useState(item.store ?? '');
  const [quantity, setQuantity] = useState(item.quantity ?? '');
  const [routine, setRoutine] = useState(!!item.routine);
  const shopping = item.list === 'shopping';

  const save = () => {
    if (!title.trim()) return;
    update.mutate(
      { id: item.id, input: shopping ? { title, childId, category, store, quantity } : { title, childId, routine } },
      { onSuccess: onClose },
    );
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={shopping ? t('family.item.editShopping') : t('family.item.editTomorrow')}
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
      <TextField label={t('family.item.title')} value={title} onChangeText={setTitle} onSubmitEditing={save} />
      <Section title={t('family.forWhom')}>
        <PersonPicker people={people} value={childId} onChange={setChildId} />
      </Section>
      {shopping ? (
        <>
          <TextField
            label={t('family.item.quantity')}
            value={quantity}
            onChangeText={setQuantity}
            placeholder={t('family.item.quantityPlaceholder')}
          />
          <Section title={t('family.item.category')}>
            <ChipGroup<string>
              accessibilityLabel={t('family.item.category')}
              selected={category ?? 'none'}
              onToggle={(v) => setCategory(v === 'none' || v === category ? null : v)}
              options={[
                { value: 'none', label: t('family.categories.none') },
                ...SHOPPING_CATEGORIES.map((c) => ({ value: c, label: t(`family.categories.${c}`) })),
                ...(category && !(SHOPPING_CATEGORIES as readonly string[]).includes(category)
                  ? [{ value: category, label: category }]
                  : []),
              ]}
            />
          </Section>
          <Section title={t('family.item.store')}>
            <TextField compact leftIcon="map-pin" value={store} onChangeText={setStore} placeholder={t('family.item.storePlaceholder')} />
            {stores.data?.length ? (
              <ChipGroup<string>
                compact
                accessibilityLabel={t('family.item.store')}
                selected={store}
                onToggle={(v) => setStore(v === store ? '' : v)}
                options={stores.data.slice(0, 8).map((s) => ({ value: s, label: s }))}
              />
            ) : null}
          </Section>
        </>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong">{t('family.item.routine')}</AppText>
            <AppText variant="small" tone="textMuted">
              {t('family.item.routineHint')}
            </AppText>
          </View>
          <Toggle label={t('family.item.routine')} value={routine} onValueChange={setRoutine} />
        </View>
      )}
    </Sheet>
  );
}

export function ItemEditSheet({ item, onClose }: { item: FamilyItem | null; onClose: () => void }) {
  return item ? <Editor key={item.id} item={item} onClose={onClose} /> : null;
}
