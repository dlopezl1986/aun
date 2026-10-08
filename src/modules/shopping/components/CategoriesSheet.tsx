import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { IconButton } from '@/components/ui/IconButton';
import { Sheet } from '@/components/ui/Sheet';
import { TextField } from '@/components/ui/TextField';
import { accentPalette, useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';
import { useCategories, useCreateCategory, useDeleteCategory } from '../hooks';

const EMOJI_SUGGESTIONS = ['🎈', '🎁', '🍷', '🌱', '🔧', '🧸', '📚', '🏖️', '🎄', '🧃', '🍕', '🐟'];

/** Categories: the built-in ones (read-only) + your own, with emoji and colour. */
function Manager({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { spacing, radius, colors } = useTheme();
  const { categories } = useCategories();
  const create = useCreateCategory();
  const remove = useDeleteCategory();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🎈');
  const [color, setColor] = useState<string>(accentPalette[8]);
  const custom = categories.filter((c) => !c.builtin);

  const add = () => {
    if (!name.trim()) return;
    create.mutate({ name, emoji, color }, { onSuccess: () => setName('') });
  };

  return (
    <Sheet visible onClose={onClose} title={t('shopping.categoriesTitle')} footer={<Button label={t('common.done')} onPress={onClose} />}>
      <AppText variant="small" tone="textMuted">
        {t('shopping.categoriesHint')}
      </AppText>
      <View style={{ gap: spacing.sm }}>
        <AppText variant="smallStrong" tone="textMuted">
          {t('shopping.newCategory')}
        </AppText>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
          <View style={{ width: 72 }}>
            <TextField compact value={emoji} onChangeText={(v) => setEmoji(v.slice(0, 4))} accessibilityLabel={t('shopping.emoji')} />
          </View>
          <View style={{ flex: 1 }}>
            <TextField compact value={name} onChangeText={setName} placeholder={t('shopping.categoryPlaceholder')} onSubmitEditing={add} />
          </View>
          <Button label={t('common.add')} onPress={add} disabled={!name.trim()} loading={create.isPending} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {EMOJI_SUGGESTIONS.map((e) => (
            <Button key={e} label={e} size="sm" variant={e === emoji ? 'soft' : 'ghost'} onPress={() => setEmoji(e)} />
          ))}
        </View>
        <ColorPicker value={color} onChange={setColor} />
      </View>

      {custom.length ? (
        <View style={{ gap: spacing.xs }}>
          <AppText variant="smallStrong" tone="textMuted">
            {t('shopping.yourCategories')}
          </AppText>
          {custom.map((c) => (
            <View
              key={c.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                padding: spacing.sm,
                borderRadius: radius.md,
                backgroundColor: withAlpha(c.color, 0.1),
              }}
            >
              <AppText variant="body">{c.emoji}</AppText>
              <AppText variant="bodyStrong" style={{ flex: 1 }}>
                {c.label}
              </AppText>
              <IconButton icon="trash-2" size={16} label={`${t('common.delete')}: ${c.label}`} onPress={() => remove.mutate(c.id)} />
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ gap: spacing.xs }}>
        <AppText variant="smallStrong" tone="textMuted">
          {t('shopping.builtinCategories')}
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {categories
            .filter((c) => c.builtin)
            .map((c) => (
              <View
                key={c.id}
                style={{
                  flexDirection: 'row',
                  gap: 4,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 4,
                  borderRadius: radius.pill,
                  backgroundColor: withAlpha(c.color, 0.12),
                }}
              >
                <AppText variant="caption">{c.emoji}</AppText>
                <AppText variant="caption" color={colors.text}>
                  {c.label}
                </AppText>
              </View>
            ))}
        </View>
      </View>
    </Sheet>
  );
}

export function CategoriesSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return visible ? <Manager onClose={onClose} /> : null;
}
