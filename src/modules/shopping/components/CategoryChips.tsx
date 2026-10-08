import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';
import type { CategoryInfo } from '../types';

interface Props {
  categories: (CategoryInfo & { label: string })[];
  value: string | null;
  onChange: (id: string | null) => void;
  accessibilityLabel: string;
}

/** Emoji + name chips, each in its category colour. Tap again to clear. */
export function CategoryChips({ categories, value, onChange, accessibilityLabel }: Props) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {categories.map((c) => {
        const active = value === c.id;
        return (
          <Pressable
            key={c.id}
            onPress={() => onChange(active ? null : c.id)}
            accessibilityRole="radio"
            aria-checked={active}
            accessibilityLabel={c.label}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              minHeight: 32,
              paddingHorizontal: spacing.md,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: active ? c.color : colors.border,
              backgroundColor: active ? withAlpha(c.color, 0.16) : colors.surface,
            }}
          >
            <AppText variant="small">{c.emoji}</AppText>
            <AppText variant="caption" color={active ? colors.text : colors.textMuted}>
              {c.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
