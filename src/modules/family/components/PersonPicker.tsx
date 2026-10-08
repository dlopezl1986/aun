import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';
import { useChildren } from '../hooks';
import { familyMeta } from '../meta';

export interface Person {
  /** `null` = "Casa" (household / general). */
  id: string | null;
  name: string;
  color: string;
}

/** "Casa" + every child profile, in a stable order. */
export function usePeople(): { people: Person[]; isLoading: boolean } {
  const { t } = useTranslation();
  const children = useChildren();
  const people = useMemo(
    () => [
      { id: null, name: t('family.home'), color: familyMeta.homeColor },
      ...(children.data ?? []).map((c) => ({ id: c.id, name: c.name, color: c.color })),
    ],
    [children.data, t],
  );
  return { people, isLoading: children.isLoading };
}

interface Props {
  people: Person[];
  value: string | null;
  onChange: (id: string | null) => void;
}

/** Chip selector "¿Para quién?" shared by family lists and quick actions. */
export function PersonPicker({ people, value, onChange }: Props) {
  const { t } = useTranslation();
  const { spacing, radius, colors } = useTheme();
  return (
    <View
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}
      accessibilityRole="radiogroup"
      accessibilityLabel={t('family.forWhom')}
    >
      {people.map((p) => {
        const active = p.id === value;
        return (
          <Pressable
            key={p.id ?? 'home'}
            onPress={() => onChange(p.id)}
            accessibilityRole="radio"
            aria-checked={active}
            accessibilityLabel={p.name}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              minHeight: 30,
              paddingHorizontal: spacing.md,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: active ? p.color : colors.border,
              backgroundColor: active ? withAlpha(p.color, 0.12) : 'transparent',
            }}
          >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.color }} />
            <AppText variant="caption" color={active ? p.color : colors.textMuted}>
              {p.name}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
