import { useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { interaction } from '@/components/ui/interaction';
import { useLocale } from '@/hooks/useLocale';
import { useNow } from '@/hooks/useNow';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';
import { formatLongDate, formatTime, toDateKey, weekdayNames } from '@/utils/date';
import { mondayIndex } from '@/utils/recurrence';
import { allDayOn, layoutDay } from '../layout';
import type { DayNote, EventOccurrence } from '../types';

const HOUR_HEIGHT = 52;
const GUTTER = 52;

interface Props {
  days: Date[];
  occurrences: EventOccurrence[];
  today: string;
  height: number;
  onSlotPress: (date: string, time: string) => void;
  onEventPress: (o: EventOccurrence) => void;
  notes?: DayNote[];
  onNotePress?: (n: DayNote) => void;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Day / week timeline: hour rows, side-by-side overlaps, all-day row, now line. */
export function TimeGrid({ days, occurrences, today, height, onSlotPress, onEventPress, notes = [], onNotePress }: Props) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { colors, spacing, radius } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const now = useNow(60_000);
  const names = useMemo(() => weekdayNames(locale), [locale]);
  const layouts = useMemo(() => days.map((d) => layoutDay(d, occurrences)), [days, occurrences]);
  const allDay = useMemo(() => days.map((d) => allDayOn(d, occurrences)), [days, occurrences]);
  const hasAllDay = allDay.some((a) => a.length > 0);
  const dayNotes = useMemo(() => days.map((d) => notes.filter((n) => n.date === toDateKey(d))), [days, notes]);
  const hasNotes = dayNotes.some((n) => n.length > 0);

  // Start the view around 07:30 instead of midnight.
  useEffect(() => {
    const id = setTimeout(() => scrollRef.current?.scrollTo({ y: HOUR_HEIGHT * 7.5, animated: false }), 0);
    return () => clearTimeout(id);
  }, []);

  const nowDate = new Date(now);
  const nowMin = nowDate.getHours() * 60 + nowDate.getMinutes();

  return (
    <View style={{ gap: spacing.xs }}>
      {/* Day headers */}
      <View style={{ flexDirection: 'row', paddingLeft: GUTTER }}>
        {days.map((d) => {
          const key = toDateKey(d);
          const isToday = key === today;
          return (
            <View
              key={key}
              style={{ flex: 1, alignItems: 'center', paddingVertical: spacing.xs }}
              accessibilityLabel={formatLongDate(d, locale)}
            >
              <AppText variant="caption" tone={isToday ? 'primary' : 'textMuted'}>
                {names[mondayIndex(d)]}
              </AppText>
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isToday ? colors.primary : 'transparent',
                }}
              >
                <AppText variant="subheading" color={isToday ? colors.onPrimary : colors.text}>
                  {d.getDate()}
                </AppText>
              </View>
            </View>
          );
        })}
      </View>

      {/* Day notes row */}
      {hasNotes ? (
        <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.xs }}>
          <View style={{ width: GUTTER, justifyContent: 'center' }}>
            <AppText variant="caption" tone="textSubtle" style={{ fontSize: 10 }}>
              {t('calendars.notes.short')}
            </AppText>
          </View>
          {dayNotes.map((items, i) => (
            <View key={i} style={{ flex: 1, gap: 2, paddingHorizontal: 2 }}>
              {items.map((n) => (
                <Pressable
                  key={n.id}
                  onPress={() => onNotePress?.(n)}
                  accessibilityRole="button"
                  accessibilityLabel={n.text}
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: radius.xs,
                    borderLeftWidth: 2,
                    borderLeftColor: n.color,
                    backgroundColor: withAlpha(n.color, 0.3),
                  }}
                >
                  <AppText
                    variant="caption"
                    color={colors.text}
                    numberOfLines={days.length > 1 ? 2 : undefined}
                    style={n.done ? { textDecorationLine: 'line-through', opacity: 0.6 } : undefined}
                  >
                    {n.text}
                  </AppText>
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      ) : null}

      {/* All-day row */}
      {hasAllDay ? (
        <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.xs }}>
          <View style={{ width: GUTTER, justifyContent: 'center' }}>
            <AppText variant="caption" tone="textSubtle" style={{ fontSize: 10 }}>
              {t('calendars.allDayShort')}
            </AppText>
          </View>
          {allDay.map((items, i) => (
            <View key={i} style={{ flex: 1, gap: 2, paddingHorizontal: 2 }}>
              {items.slice(0, 3).map((o) => (
                <Pressable
                  key={o.key}
                  onPress={() => onEventPress(o)}
                  accessibilityRole="button"
                  accessibilityLabel={`${o.event.title}, ${t('calendars.allDay')}`}
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: radius.xs,
                    backgroundColor: withAlpha(o.calendar.color, 0.18),
                  }}
                >
                  <AppText variant="caption" color={o.calendar.color} numberOfLines={1}>
                    {o.event.title}
                  </AppText>
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      ) : null}

      {/* Hours */}
      <ScrollView ref={scrollRef} style={{ height }} nestedScrollEnabled showsVerticalScrollIndicator>
        <View style={{ flexDirection: 'row', height: HOUR_HEIGHT * 24 }}>
          <View style={{ width: GUTTER }}>
            {Array.from({ length: 24 }, (_, h) => (
              <View key={h} style={{ height: HOUR_HEIGHT, paddingRight: spacing.sm, alignItems: 'flex-end' }}>
                <AppText variant="caption" tone="textSubtle" style={{ marginTop: -7, fontSize: 11 }}>
                  {h === 0 ? '' : `${pad(h)}:00`}
                </AppText>
              </View>
            ))}
          </View>
          {days.map((d, i) => {
            const key = toDateKey(d);
            return (
              <View key={key} style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: colors.border }}>
                {Array.from({ length: 24 }, (_, h) => (
                  <Pressable
                    key={h}
                    onPress={() => onSlotPress(key, `${pad(h)}:00`)}
                    accessibilityRole="button"
                    accessibilityLabel={t('calendars.newEventAt', { time: `${pad(h)}:00`, date: formatLongDate(d, locale) })}
                    style={(s) => ({
                      height: HOUR_HEIGHT,
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                      backgroundColor: interaction(s).hovered ? colors.surfaceMuted : 'transparent',
                    })}
                  />
                ))}
                {layouts[i].map((p) => {
                  const top = (p.startMin / 60) * HOUR_HEIGHT;
                  const h = Math.max(((p.endMin - p.startMin) / 60) * HOUR_HEIGHT - 2, 18);
                  const c = p.occurrence.calendar.color;
                  return (
                    <Pressable
                      key={p.occurrence.key}
                      onPress={() => onEventPress(p.occurrence)}
                      accessibilityRole="button"
                      accessibilityLabel={`${formatTime(p.occurrence.start, locale)}, ${p.occurrence.event.title}, ${p.occurrence.calendar.name}`}
                      style={(s) => ({
                        position: 'absolute',
                        top,
                        height: h,
                        left: `${(p.column / p.columns) * 100}%`,
                        width: `${100 / p.columns}%`,
                        paddingRight: 2,
                        opacity: interaction(s).pressed ? 0.8 : 1,
                      })}
                    >
                      <View
                        style={{
                          flex: 1,
                          borderRadius: radius.sm,
                          borderLeftWidth: 3,
                          borderLeftColor: c,
                          backgroundColor: withAlpha(c, 0.16),
                          paddingHorizontal: 4,
                          paddingVertical: 2,
                          overflow: 'hidden',
                        }}
                      >
                        <AppText variant="caption" color={c} numberOfLines={h > 36 ? 2 : 1}>
                          {p.occurrence.event.title}
                        </AppText>
                        {h > 34 ? (
                          <AppText variant="caption" tone="textMuted" numberOfLines={1} style={{ fontSize: 10, lineHeight: 12 }}>
                            {formatTime(p.occurrence.start, locale)}
                          </AppText>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
                {key === today ? (
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: (nowMin / 60) * HOUR_HEIGHT,
                      height: 2,
                      backgroundColor: colors.danger,
                    }}
                  >
                    <View
                      style={{
                        position: 'absolute',
                        left: -4,
                        top: -3,
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: colors.danger,
                      }}
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
