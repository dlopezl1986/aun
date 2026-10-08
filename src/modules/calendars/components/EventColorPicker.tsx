import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { accentPalette, useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';

interface Props {
  /** `null` = the calendar's colour. */
  value: string | null;
  calendarColor: string;
  onChange: (color: string | null) => void;
}

/**
 * "Del calendario" + the palette. The chosen colour fills the event; the
 * calendar colour remains as its stripe, so whose event it is stays visible.
 */
export function EventColorPicker({ value, calendarColor, onChange }: Props) {
  const { t } = useTranslation();
  const { spacing, colors, radius } = useTheme();
  const same = (a: string | null, b: string) => !!a && a.toLowerCase() === b.toLowerCase();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }} accessibilityRole="radiogroup">
      <Pressable
        onPress={() => onChange(null)}
        accessibilityRole="radio"
        aria-checked={!value}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          height: 36,
          paddingLeft: 4,
          paddingRight: spacing.md,
          borderRadius: radius.pill,
          borderWidth: !value ? 2 : 1,
          borderColor: !value ? calendarColor : colors.border,
          backgroundColor: !value ? withAlpha(calendarColor, 0.12) : colors.surface,
        }}
      >
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: calendarColor,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {!value ? <Icon name="check" size={14} color="#FFFFFF" /> : null}
        </View>
        <AppText variant="smallStrong">{t('calendars.eventColor.fromCalendar')}</AppText>
      </Pressable>
      {accentPalette.map((c) => {
        const selected = same(value, c);
        return (
          <Pressable
            key={c}
            onPress={() => onChange(c)}
            accessibilityRole="radio"
            aria-checked={selected}
            accessibilityLabel={`${t('common.color')} ${c}`}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: c,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: selected ? 3 : 0,
              borderColor: colors.surface,
              boxShadow: selected ? `0px 0px 0px 2px ${c}` : 'none',
            }}
          >
            {selected ? <Icon name="check" size={14} color="#FFFFFF" /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
