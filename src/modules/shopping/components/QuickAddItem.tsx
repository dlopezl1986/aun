import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useTheme } from '@/theme';
import { useAddShoppingItem, useCategories } from '../hooks';
import { parseShoppingInput } from '../service';
import { CategoryChips } from './CategoryChips';

interface Props {
  listId: string;
  autoFocus?: boolean;
  /** Shows the category chips row (screen); the dashboard sheet hides it. */
  showCategories?: boolean;
  onAdded?: () => void;
}

/** "2 leche #lácteos @mercadona" + Enter. Chips are a tap-friendly alternative. */
export function QuickAddItem({ listId, autoFocus, showCategories = true, onAdded }: Props) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { categories, byId } = useCategories();
  const add = useAddShoppingItem();
  const [text, setText] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const parsed = useMemo(
    () =>
      parseShoppingInput(
        text,
        categories.map((c) => ({ id: c.id, name: c.label })),
      ),
    [text, categories],
  );
  const cat = byId.get(parsed.categoryId ?? categoryId ?? '');

  const submit = () => {
    if (!parsed.title) return;
    add.mutate(
      {
        listId,
        title: parsed.title,
        quantity: parsed.quantity,
        store: parsed.store,
        categoryId: parsed.categoryId ?? categoryId ?? undefined,
      },
      {
        onSuccess: () => {
          setText('');
          onAdded?.();
        },
      },
    );
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <TextField
            autoFocus={autoFocus}
            leftIcon="plus"
            value={text}
            onChangeText={setText}
            onSubmitEditing={submit}
            submitBehavior="submit"
            returnKeyType="done"
            placeholder={t('shopping.addPlaceholder')}
            accessibilityLabel={t('shopping.addPlaceholder')}
          />
        </View>
        <Button label={t('common.add')} onPress={submit} disabled={!parsed.title} loading={add.isPending} />
      </View>
      {parsed.title && (parsed.quantity || cat || parsed.store) ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' }} accessibilityLiveRegion="polite">
          <AppText variant="caption" tone="textSubtle">
            {t('shopping.detected')}
          </AppText>
          {parsed.quantity ? <Badge label={parsed.quantity} icon="hash" /> : null}
          {cat ? <Badge label={`${cat.emoji} ${cat.label}`} color={cat.color} /> : null}
          {parsed.store ? <Badge label={parsed.store} icon="map-pin" /> : null}
        </View>
      ) : (
        <AppText variant="caption" tone="textSubtle">
          {t('shopping.addHint')}
        </AppText>
      )}
      {showCategories ? (
        <CategoryChips
          categories={categories}
          value={parsed.categoryId ?? categoryId}
          onChange={setCategoryId}
          accessibilityLabel={t('shopping.fields.category')}
        />
      ) : null}
    </View>
  );
}
