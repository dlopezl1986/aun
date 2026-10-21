import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { accentPalette, useTheme } from '@/theme';
import { isLight } from '@/utils/color';
import { AppText } from './AppText';
import { Icon } from './Icon';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
}

export function ColorPicker({ value, onChange, label }: ColorPickerProps) {
  const { spacing, colors } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="smallStrong">{label ?? t('common.color')}</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }} accessibilityRole="radiogroup">
        {accentPalette.map((c) => {
          const selected = c.toLowerCase() === value.toLowerCase();
          return (
            <Pressable
              key={c}
              onPress={() => onChange(c)}
              accessibilityRole="radio"
              aria-checked={selected}
              accessibilityLabel={`${t('common.color')} ${c}`}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: c,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: selected ? 3 : isLight(c) ? 1 : 0,
                // Light colours get a thin outline so they show on light backgrounds.
                borderColor: selected ? colors.surface : colors.borderStrong,
                boxShadow: selected ? `0px 0px 0px 2px ${c}` : 'none',
              }}
            >
              {selected ? <Icon name="check" size={16} color={isLight(c) ? '#111827' : '#FFFFFF'} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
