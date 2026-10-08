import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { interaction } from '@/components/ui/interaction';
import { hitSize, useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';
import type { CategoryInfo, ShoppingItem } from '../types';

interface Props {
  item: ShoppingItem;
  category?: CategoryInfo & { label: string };
  personName?: string;
  personColor?: string;
  showStore?: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onRemove: () => void;
}

/** One product: big tap target to tick it off, details in small chips. */
export function ShoppingItemRow({ item, category, personName, personColor, showStore = true, onToggle, onEdit, onRemove }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const done = item.done;
  const tint = category?.color ?? colors.textSubtle;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        aria-checked={done}
        accessibilityLabel={[item.title, item.quantity, done ? t('shopping.bought') : null].filter(Boolean).join(', ')}
        style={(s) => ({
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          minHeight: hitSize + 4,
          paddingHorizontal: spacing.sm,
          borderRadius: radius.md,
          backgroundColor: interaction(s).hovered ? colors.surfaceMuted : 'transparent',
        })}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: done ? colors.success : withAlpha(tint, 0.7),
            backgroundColor: done ? colors.success : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {done ? <Icon name="check" size={14} color="#FFFFFF" /> : null}
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <AppText
              variant="bodyStrong"
              tone={done ? 'textSubtle' : 'text'}
              style={done ? { textDecorationLine: 'line-through' } : undefined}
              numberOfLines={1}
            >
              {item.title}
            </AppText>
            {item.quantity ? (
              <View style={{ paddingHorizontal: 7, paddingVertical: 1, borderRadius: radius.pill, backgroundColor: withAlpha(tint, 0.14) }}>
                <AppText variant="caption" color={done ? colors.textSubtle : colors.text}>
                  {item.quantity}
                </AppText>
              </View>
            ) : null}
          </View>
          {(showStore && item.store) || personName || item.notes ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {showStore && item.store ? (
                <AppText variant="caption" tone="textMuted">
                  📍 {item.store}
                </AppText>
              ) : null}
              {personName ? (
                <AppText variant="caption" color={personColor ?? colors.textMuted}>
                  ● {personName}
                </AppText>
              ) : null}
              {item.notes ? (
                <AppText variant="caption" tone="textSubtle" numberOfLines={1}>
                  {item.notes}
                </AppText>
              ) : null}
            </View>
          ) : null}
        </View>
      </Pressable>
      <IconButton icon="edit-2" size={15} label={`${t('common.edit')}: ${item.title}`} onPress={onEdit} />
      <IconButton icon="x" size={16} label={`${t('common.delete')}: ${item.title}`} onPress={onRemove} />
    </View>
  );
}
