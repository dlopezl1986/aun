import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { IconButton } from '@/components/ui/IconButton';
import { interaction } from '@/components/ui/interaction';
import { useLocale } from '@/hooks/useLocale';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';
import { addDays, formatShortDate, fromDateKey, toDateKey, weekdayNames } from '@/utils/date';
import { mondayIndex } from '@/utils/recurrence';
import { opMeta } from '../meta';
import type { OpSession } from '../types';

/**
 * The week (Monday to Sunday) as seven day buttons: each one shows how many
 * topics it has and whether hours were logged. Arrows move week by week.
 */
export function WeekStrip({
  selected,
  today,
  sessions,
  onSelect,
}: {
  selected: string;
  today: string;
  sessions: Map<string, OpSession>;
  onSelect: (date: string) => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { colors, spacing, radius } = useTheme();
  const accent = opMeta.accent;
  const anchor = fromDateKey(selected);
  const monday = addDays(anchor, -mondayIndex(anchor));
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const names = weekdayNames(locale);
  const range = `${formatShortDate(days[0], locale)} – ${formatShortDate(days[6], locale)}`;

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        <IconButton icon="chevron-left" label={t('op.week.previous')} onPress={() => onSelect(toDateKey(addDays(anchor, -7)))} />
        <AppText variant="bodyStrong" style={{ flex: 1, textAlign: 'center' }}>
          {range}
        </AppText>
        {selected !== today ? (
          <Pressable onPress={() => onSelect(today)} accessibilityRole="button" hitSlop={8}>
            <AppText variant="smallStrong" color={accent}>
              {t('common.today')}
            </AppText>
          </Pressable>
        ) : null}
        <IconButton icon="chevron-right" label={t('op.week.next')} onPress={() => onSelect(toDateKey(addDays(anchor, 7)))} />
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {days.map((d, i) => {
          const key = toDateKey(d);
          const s = sessions.get(key);
          const isSel = key === selected;
          const isToday = key === today;
          const topics = s?.topicIds.length ?? 0;
          const logged = !!s?.hours;
          return (
            <Pressable
              key={key}
              onPress={() => onSelect(key)}
              accessibilityRole="button"
              aria-selected={isSel}
              accessibilityLabel={`${formatShortDate(d, locale)}${topics ? `, ${t('op.week.topics', { count: topics })}` : ''}`}
              style={(st) => ({
                flex: 1,
                minWidth: 0,
                alignItems: 'center',
                gap: 2,
                paddingVertical: spacing.sm,
                borderRadius: radius.md,
                backgroundColor: isSel
                  ? accent
                  : interaction(st).hovered
                    ? withAlpha(accent, 0.08)
                    : s
                      ? withAlpha(accent, 0.05)
                      : colors.surfaceMuted,
                borderWidth: isToday && !isSel ? 2 : 0,
                borderColor: accent,
              })}
            >
              <AppText variant="caption" color={isSel ? '#FFFFFF' : colors.textMuted}>
                {names[i]}
              </AppText>
              <AppText variant="bodyStrong" color={isSel ? '#FFFFFF' : colors.text}>
                {d.getDate()}
              </AppText>
              <View style={{ flexDirection: 'row', gap: 3, height: 6, alignItems: 'center' }}>
                {Array.from({ length: Math.min(topics, 4) }, (_, j) => (
                  <View
                    key={j}
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 3,
                      backgroundColor: isSel ? '#FFFFFF' : logged ? accent : withAlpha(accent, 0.45),
                    }}
                  />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
