import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
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
import { HOLIDAY_COLOR } from '../holidays';
import { layoutWeek, type WeekBar } from '../monthLayout';
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
  /** Double click / double tap on a day, or its "+N más": everything on that day. */
  onDayOpen?: (dateKey: string) => void;
  /** Shift mode: a tap anywhere on a day paints / erases it (no event opening, no dragging). */
  onPaint?: (dateKey: string) => void;
  /** Public holidays shown (date → name): the day is tinted light red. */
  holidays?: Map<string, string>;
}

/** Two presses on the same day within this time are a double click / double tap. */
const DOUBLE_PRESS_MS = 300;
/** Time of a press (only ever called from press handlers). */
const pressTime = () => Date.now();

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
  onDayOpen,
  holidays,
  onPaint,
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

  // A second press on the same day soon after the first opens the whole day. Presses on an
  // event / note wait that long before opening it, so a double click never opens both.
  const lastPress = useRef<{ day: string; at: number } | null>(null);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (pending.current && clearTimeout(pending.current)), []);
  const pressDay = (day: string, single: () => void, waitForDouble: boolean) => {
    if (onPaint) return onPaint(day);
    const now = pressTime();
    const prev = lastPress.current;
    if (pending.current) {
      clearTimeout(pending.current);
      pending.current = null;
    }
    if (onDayOpen && prev && prev.day === day && now - prev.at < DOUBLE_PRESS_MS) {
      lastPress.current = null;
      onDayOpen(day);
      return;
    }
    lastPress.current = { day, at: now };
    if (waitForDouble && onDayOpen)
      pending.current = setTimeout(() => {
        pending.current = null;
        single();
      }, DOUBLE_PRESS_MS);
    else single();
  };

  // Long press picks an event / note up; dropping it on another day moves it.
  const startDrag = (label: Label, from: string, point: DragPoint, moved = false) => {
    if (!canDrag || onPaint || (label.note ? !onMoveNote : !onMoveEvent)) return;
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

  const eventLabel = (o: EventOccurrence): Label => ({
    key: o.key,
    text: shortShiftTitle(o.event.title, t),
    color: occurrenceColor(o),
    stripe: o.calendar.color,
    occurrence: o,
  });

  // Per week: events of several days become bars across their days (in rows on top);
  // the rest are labels in their day — notes first (reminders), then events in time order.
  const layout = useMemo(
    () =>
      weeks.map((week) => {
        const { bars, lanes, singles } = layoutWeek(occurrences, week);
        const labels = new Map<string, Label[]>();
        const push = (key: string, l: Label) => labels.set(key, [...(labels.get(key) ?? []), l]);
        for (const n of notes) push(n.date, { key: n.id, text: n.text, color: n.color, note: n });
        for (const [key, list] of singles) for (const o of list) push(key, eventLabel(o));
        return { bars, lanes, labels };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [weeks, occurrences, notes, t],
  );
  // Bar rows shown per week (more go to "+N").
  const maxLanes = isCompact ? 2 : 3;
  const barHeight = isCompact ? 13 : 17;
  const barGap = 2;
  const cellPadding = isCompact ? 1 : 2;

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
      {weeks.map((week, w) => {
        const { bars, lanes, labels } = layout[w];
        const shownLanes = Math.min(lanes, maxLanes);
        return (
          <View key={toDateKey(week[0])} style={[styles.row, { position: 'relative' }]}>
            {week.map((day, col) => {
              const key = toDateKey(day);
              const inMonth = day.getMonth() === month.getMonth();
              const isSelected = key === selected;
              const isToday = key === today;
              const holiday = holidays?.get(key) ?? null;
              const items = labels.get(key) ?? [];
              // Lines left for this day's own labels once the bar rows are drawn.
              const room = Math.max(1, maxLines - shownLanes);
              const shown = items.length > room ? items.slice(0, room - 1) : items;
              const hiddenBars = bars.filter((b) => b.lane >= maxLanes && col >= b.col && col < b.col + b.span).length;
              const more = items.length - shown.length + hiddenBars;
              return (
                // The whole cell selects the day (a pressable layer behind); the labels on top are their own
                // buttons, so nothing is nested inside another button.
                <View
                  key={key}
                  {...dropDay(key)}
                  style={[
                    styles.dayCell,
                    { minHeight: isCompact ? 76 : 104, padding: isCompact ? 1 : 2, opacity: inMonth ? 1 : 0.55 },
                    holiday && { backgroundColor: withAlpha(HOLIDAY_COLOR, 0.12) },
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
                    onPress={() => pressDay(key, () => onSelect(key), false)}
                    accessibilityRole="button"
                    aria-selected={isSelected}
                    accessibilityLabel={holiday ? `${formatLongDate(day, locale)}, ${holiday}` : formatLongDate(day, locale)}
                    accessibilityHint={onDayOpen ? t('calendars.daySheet.hint') : undefined}
                    style={(s) => [
                      StyleSheet.absoluteFill,
                      interaction(s).hovered && !isSelected && { backgroundColor: colors.surfaceMuted },
                    ]}
                  />
                  <View pointerEvents="none" style={[styles.dayNumber, isToday && { backgroundColor: colors.primary }]}>
                    <AppText
                      variant="caption"
                      color={isToday ? colors.onPrimary : holiday ? '#DC2626' : inMonth ? colors.text : colors.textSubtle}
                    >
                      {day.getDate()}
                    </AppText>
                  </View>
                  {shownLanes ? <View pointerEvents="none" style={{ height: shownLanes * (barHeight + barGap) - barGap }} /> : null}
                  {shown.map((l) => (
                    <Pressable
                      key={l.key}
                      {...mouseDraggable(`m:${l.key}`, (p) => startDrag(l, key, p, true))}
                      onPress={() => {
                        if (justDragged()) return;
                        pressDay(
                          key,
                          () => {
                            onSelect(key);
                            if (l.occurrence) onEventPress?.(l.occurrence);
                            else if (l.note) onNotePress?.(l.note);
                          },
                          true,
                        );
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
                    <Pressable
                      onPress={() => (onDayOpen ? onDayOpen(key) : onSelect(key))}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('calendars.moreItems', { count: more })}. ${t('calendars.daySheet.open')}`}
                      hitSlop={4}
                      style={(s) => ({ borderRadius: 3, backgroundColor: interaction(s).hovered ? colors.surfaceMuted : 'transparent' })}
                    >
                      <AppText variant="caption" tone="primary" style={{ fontSize: isCompact ? 9.5 : 11, paddingHorizontal: 2 }}>
                        {t('calendars.moreItems', { count: more })}
                      </AppText>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
            {bars
              .filter((b) => b.lane < maxLanes)
              .map((b) => (
                <EventBar
                  key={`${b.occurrence.key}:${w}`}
                  bar={b}
                  label={eventLabel(b.occurrence)}
                  from={toDateKey(week[b.col])}
                  top={cellPadding + 22 + barGap + b.lane * (barHeight + barGap)}
                  height={barHeight}
                  compact={isCompact}
                  dragging={drag?.label.key === b.occurrence.key}
                  onPress={(col) => {
                    if (justDragged()) return;
                    // The day under the pointer (a bar covers several).
                    const day = toDateKey(week[Math.min(6, b.col + col)]);
                    pressDay(
                      day,
                      () => {
                        onSelect(day);
                        onEventPress?.(b.occurrence);
                      },
                      true,
                    );
                  }}
                  onDragStart={(l, from, p, moved) => startDrag(l, from, p, moved)}
                />
              ))}
          </View>
        );
      })}
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

/** Which of a bar's `span` days was pressed (0 = first), from where the press landed on it. */
function pressedColumn(e: GestureResponderEvent, span: number): number {
  const ne = e.nativeEvent as { locationX?: number; clientX?: number; pageX?: number };
  const el = e.currentTarget as unknown as { getBoundingClientRect?: () => { left: number; width: number } };
  let x: number | undefined;
  let width = 0;
  if (typeof el?.getBoundingClientRect === 'function' && typeof ne.clientX === 'number') {
    // Web: the press position against the bar's real box.
    const r = el.getBoundingClientRect();
    x = ne.clientX - r.left;
    width = r.width;
  }
  if (x === undefined || !width) return 0;
  return Math.min(span - 1, Math.max(0, Math.floor((x / width) * span)));
}

/** An event of several days: one bar of its colour across the days it covers in this week. */
function EventBar({
  bar,
  label,
  from,
  top,
  height,
  compact,
  dragging,
  onPress,
  onDragStart,
}: {
  bar: WeekBar;
  label: Label;
  /** Day the bar starts in this week (drag & drop moves the event by the days it is dragged). */
  from: string;
  top: number;
  height: number;
  compact: boolean;
  dragging: boolean;
  /** `col`: which of the bar's days was pressed (0 = its first in this week). */
  onPress: (col: number) => void;
  onDragStart: (label: Label, from: string, point: DragPoint, moved?: boolean) => void;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const locale = useLocale();
  const o = bar.occurrence;
  const inset = 2;
  const radius = 3;
  return (
    <Pressable
      {...mouseDraggable(`m:${label.key}:${from}`, (p) => onDragStart(label, from, p, true))}
      onPress={(e) => onPress(pressedColumn(e, bar.span))}
      onLongPress={(e) => onDragStart(label, from, pointOf(e))}
      delayLongPress={250}
      accessibilityRole="button"
      accessibilityLabel={`${label.text}, ${formatLongDate(o.start, locale)} – ${formatLongDate(new Date(o.end.getTime() - 1), locale)}`}
      accessibilityHint={canDrag ? t('calendars.move.hint') : undefined}
      style={(s) => [
        {
          position: 'absolute',
          top,
          height,
          // Continues from / into the next week: straight edge flush with the cell border.
          left: `${(bar.col / 7) * 100}%`,
          width: `${(bar.span / 7) * 100}%`,
          paddingLeft: bar.startsHere ? inset : 0,
          paddingRight: bar.endsHere ? inset : 0,
          zIndex: 2,
          userSelect: 'none',
        } as object,
        dragging && { opacity: 0.35 },
        { opacity: interaction(s).pressed ? 0.8 : 1 },
      ]}
    >
      {(s) => (
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            paddingHorizontal: 3,
            overflow: 'hidden',
            // Same colours as the day labels: own colour as the fill, the calendar (person) colour as the stripe.
            backgroundColor: withAlpha(label.color, (label.color !== label.stripe ? 0.4 : 0.25) + (interaction(s).hovered ? 0.1 : 0)),
            borderLeftWidth: bar.startsHere ? 3 : 0,
            borderLeftColor: label.stripe,
            borderTopLeftRadius: bar.startsHere ? radius : 0,
            borderBottomLeftRadius: bar.startsHere ? radius : 0,
            borderTopRightRadius: bar.endsHere ? radius : 0,
            borderBottomRightRadius: bar.endsHere ? radius : 0,
          }}
        >
          <AppText
            numberOfLines={1}
            color={colors.text}
            style={compact ? { fontSize: 9, lineHeight: 11, letterSpacing: -0.3 } : { fontSize: 11, lineHeight: 14 }}
          >
            {label.text}
          </AppText>
        </View>
      )}
    </Pressable>
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
