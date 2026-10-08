import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { IconButton } from '@/components/ui/IconButton';
import { interaction } from '@/components/ui/interaction';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useLocale } from '@/hooks/useLocale';
import { makeStyles, useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';
import { addMonths, formatLongDate, formatMonthYear, monthMatrix, toDateKey, weekdayNames } from '@/utils/date';
import {
  canDrag,
  DragGhost,
  dropDay,
  dropTargetAt,
  followPointer,
  justDragged,
  mouseDraggable,
  pointOf,
  type DragPoint,
} from '../dragDrop';
import { shortShiftTitle } from '../shifts';
import { occurrenceColor, type DayNote, type EventOccurrence } from '../types';

interface MonthGridProps {
  month: Date;
  selected: string;
  today: string;
  occurrences: EventOccurrence[];
  notes?: DayNote[];
  onSelect: (dateKey: string) => void;
  onMonthChange: (month: Date) => void;
  /** Tapping an event / note inside a day opens it directly. */
  onEventPress?: (o: EventOccurrence) => void;
  onNotePress?: (n: DayNote) => void;
  /** Drag & drop to another day (web). */
  onMoveEvent?: (o: EventOccurrence, from: string, to: string) => void;
  onMoveNote?: (n: DayNote, to: string) => void;
}

/** One line inside a day cell: the event name (or note text) on its colour. */
type Label = { key: string; text: string; color: string; stripe?: string; note?: DayNote; occurrence?: EventOccurrence };

export function MonthGrid({
  month,
  selected,
  today,
  occurrences,
  notes = [],
  onSelect,
  onMonthChange,
  onEventPress,
  onNotePress,
  onMoveEvent,
  onMoveNote,
}: MonthGridProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const locale = useLocale();
  const { t } = useTranslation();
  const { isCompact } = useBreakpoint();
  const weeks = useMemo(() => monthMatrix(month), [month]);
  const names = useMemo(() => weekdayNames(locale), [locale]);
  // Phones have ~50px wide cells: fewer, shorter lines.
  const maxLines = isCompact ? 3 : 4;
  const [drag, setDrag] = useState<{ label: Label; from: string; point: DragPoint; over: string | null } | null>(null);

  // Long press picks an event / note up; dropping it on another day moves it.
  const startDrag = (label: Label, from: string, point: DragPoint, moved = false) => {
    if (!canDrag || (label.note ? !onMoveNote : !onMoveEvent)) return;
    const started = followPointer(
      {
        move: (p) => setDrag((d) => d && { ...d, point: p, over: dropTargetAt(p)?.day ?? null }),
        end: (p) => {
          setDrag(null);
          const to = p ? dropTargetAt(p)?.day : null;
          if (!to || to === from) return;
          if (label.note) onMoveNote?.(label.note, to);
          else if (label.occurrence) onMoveEvent?.(label.occurrence, from, to);
        },
      },
      point,
      moved,
    );
    if (started) setDrag({ label, from, point, over: moved ? (dropTargetAt(point)?.day ?? null) : from });
  };

  // dateKey → notes first (reminders), then events in time order.
  const labels = useMemo(() => {
    const map = new Map<string, Label[]>();
    const push = (key: string, l: Label) => map.set(key, [...(map.get(key) ?? []), l]);
    for (const n of notes) push(n.date, { key: n.id, text: n.text, color: n.color, note: n });
    for (const o of occurrences)
      push(toDateKey(o.start), {
        key: o.key,
        text: shortShiftTitle(o.event.title, t),
        color: occurrenceColor(o),
        stripe: o.calendar.color,
        occurrence: o,
      });
    return map;
  }, [occurrences, notes, t]);

  return (
    <View>
      <View style={styles.header}>
        <AppText variant="heading" accessibilityRole="header" style={{ flex: 1 }}>
          {formatMonthYear(month, locale)}
        </AppText>
        <IconButton icon="chevron-left" label={t('calendars.prevMonth')} onPress={() => onMonthChange(addMonths(month, -1))} />
        <IconButton
          icon="crosshair"
          label={t('calendars.goToday')}
          onPress={() => {
            onMonthChange(new Date());
            onSelect(today);
          }}
        />
        <IconButton icon="chevron-right" label={t('calendars.nextMonth')} onPress={() => onMonthChange(addMonths(month, 1))} />
      </View>
      <View style={styles.row}>
        {names.map((n) => (
          <View key={n} style={styles.weekday}>
            <AppText variant="caption" tone="textSubtle" align="center">
              {n}
            </AppText>
          </View>
        ))}
      </View>
      {weeks.map((week) => (
        <View key={toDateKey(week[0])} style={styles.row}>
          {week.map((day) => {
            const key = toDateKey(day);
            const inMonth = day.getMonth() === month.getMonth();
            const isSelected = key === selected;
            const isToday = key === today;
            const items = labels.get(key) ?? [];
            const shown = items.length > maxLines ? items.slice(0, maxLines - 1) : items;
            const more = items.length - shown.length;
            return (
              // The whole cell selects the day (a pressable layer behind); the labels on top are their own
              // buttons, so nothing is nested inside another button.
              <View
                key={key}
                {...dropDay(key)}
                style={[
                  styles.dayCell,
                  { minHeight: isCompact ? 76 : 104, padding: isCompact ? 1 : 2, opacity: inMonth ? 1 : 0.55 },
                  isSelected && { borderColor: colors.primary, backgroundColor: withAlpha(colors.primary, 0.06) },
                  drag?.over === key &&
                    drag.from !== key && {
                      borderColor: colors.primary,
                      borderWidth: 2,
                      backgroundColor: withAlpha(colors.primary, 0.14),
                      zIndex: 1,
                    },
                ]}
              >
                <Pressable
                  onPress={() => onSelect(key)}
                  accessibilityRole="button"
                  aria-selected={isSelected}
                  accessibilityLabel={formatLongDate(day, locale)}
                  style={(s) => [
                    StyleSheet.absoluteFill,
                    interaction(s).hovered && !isSelected && { backgroundColor: colors.surfaceMuted },
                  ]}
                />
                <View pointerEvents="none" style={[styles.dayNumber, isToday && { backgroundColor: colors.primary }]}>
                  <AppText variant="caption" color={isToday ? colors.onPrimary : inMonth ? colors.text : colors.textSubtle}>
                    {day.getDate()}
                  </AppText>
                </View>
                {shown.map((l) => (
                  <Pressable
                    key={l.key}
                    {...mouseDraggable(`m:${l.key}`, (p) => startDrag(l, key, p, true))}
                    onPress={() => {
                      if (justDragged()) return;
                      onSelect(key);
                      if (l.occurrence) onEventPress?.(l.occurrence);
                      else if (l.note) onNotePress?.(l.note);
                    }}
                    onLongPress={(e) => startDrag(l, key, pointOf(e))}
                    delayLongPress={250}
                    accessibilityRole="button"
                    accessibilityLabel={l.text}
                    accessibilityHint={canDrag ? t('calendars.move.hint') : undefined}
                    style={(s) => [
                      styles.label,
                      { userSelect: 'none' } as object,
                      drag?.label.key === l.key && { opacity: 0.35 },
                      // Notes: dashed sticky-note outline. Events: own colour as the fill, the
                      // calendar (person) colour as the stripe.
                      l.note
                        ? { backgroundColor: withAlpha(l.color, 0.3), borderWidth: 1, borderStyle: 'dashed', borderColor: l.color }
                        : {
                            // Own colours (shifts…) read as solid blocks; calendar colours stay soft.
                            backgroundColor: withAlpha(l.color, (l.color !== l.stripe ? 0.4 : 0.2) + (interaction(s).hovered ? 0.1 : 0)),
                            borderLeftWidth: 3,
                            borderLeftColor: l.stripe,
                          },
                    ]}
                  >
                    <AppText
                      numberOfLines={2}
                      color={colors.text}
                      style={[
                        // Never split a word in two ("Mañan/a"): wrap between words only.
                        { overflowWrap: 'normal', wordBreak: 'keep-all' } as object,
                        isCompact ? { fontSize: 9, lineHeight: 11, letterSpacing: -0.3 } : { fontSize: 11, lineHeight: 14 },
                        l.note?.done ? { textDecorationLine: 'line-through', opacity: 0.6 } : null,
                      ]}
                    >
                      {l.text}
                    </AppText>
                  </Pressable>
                ))}
                {more > 0 ? (
                  <AppText
                    pointerEvents="none"
                    variant="caption"
                    tone="textMuted"
                    style={{ fontSize: isCompact ? 9.5 : 11, paddingHorizontal: 2 }}
                  >
                    {t('calendars.moreItems', { count: more })}
                  </AppText>
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
      {drag ? (
        <DragGhost
          point={drag.point}
          label={drag.label.text}
          color={drag.label.color}
          hint={drag.over && drag.over !== drag.from ? `→ ${formatLongDate(new Date(`${drag.over}T12:00:00`), locale)}` : null}
        />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  header: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs, marginBottom: t.spacing.sm },
  row: { flexDirection: 'row' },
  weekday: { flex: 1, alignItems: 'center', paddingVertical: t.spacing.xs },
  dayCell: {
    flex: 1,
    minWidth: 0,
    padding: 2,
    gap: 2,
    borderWidth: 1,
    borderColor: t.colors.border,
    marginLeft: -1,
    marginTop: -1,
  },
  dayNumber: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  label: { borderRadius: 3, paddingHorizontal: 1.5, paddingVertical: 1, overflow: 'hidden' },
}));
