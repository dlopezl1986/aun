import { useEffect, useMemo, useRef, useState } from 'react';
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
  /** Drag & drop (web): to another day and, in the hours area, another time. */
  onMoveEvent?: (o: EventOccurrence, from: string, to: string, toTime: string | null) => void;
  onMoveNote?: (n: DayNote, to: string) => void;
}

interface Drag {
  key: string;
  label: string;
  color: string;
  from: string;
  occurrence?: EventOccurrence;
  note?: DayNote;
  /** Minutes between the event start and where it was grabbed (timed events). */
  grabMin: number;
  durMin: number;
  point: DragPoint;
  over: { day: string; min: number | null } | null;
}

const SNAP = 15;
const toHHMM = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

const pad = (n: number) => String(n).padStart(2, '0');

/** Day / week timeline: hour rows, side-by-side overlaps, all-day row, now line. */
export function TimeGrid({
  days,
  occurrences,
  today,
  height,
  onSlotPress,
  onEventPress,
  notes = [],
  onNotePress,
  onMoveEvent,
  onMoveNote,
}: Props) {
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
  const [drag, setDrag] = useState<Drag | null>(null);

  /** Day + snapped start time under the pointer (time only over the hours columns). */
  const targetAt = (p: DragPoint, d: Pick<Drag, 'grabMin' | 'occurrence'>) => {
    const target = dropTargetAt(p);
    if (!target) return null;
    if (!target.hours || !d.occurrence || d.occurrence.event.allDay) return { day: target.day, min: null };
    const raw = ((p.y - target.rect.top) / HOUR_HEIGHT) * 60 - d.grabMin;
    return { day: target.day, min: Math.min(24 * 60 - SNAP, Math.max(0, Math.round(raw / SNAP) * SNAP)) };
  };

  const startDrag = (d: Omit<Drag, 'over'>, moved = false) => {
    if (!canDrag || (d.note ? !onMoveNote : !onMoveEvent)) return;
    const started = followPointer(
      {
        move: (p) => setDrag((cur) => cur && { ...cur, point: p, over: targetAt(p, cur) }),
        end: (p) => {
          setDrag(null);
          const to = p ? targetAt(p, d) : null;
          if (!to) return;
          if (d.note) {
            if (to.day !== d.from) onMoveNote?.(d.note, to.day);
            return;
          }
          if (!d.occurrence) return;
          const sameTime = to.min === null || to.min === d.occurrence.start.getHours() * 60 + d.occurrence.start.getMinutes();
          if (to.day === d.from && sameTime) return;
          onMoveEvent?.(d.occurrence, d.from, to.day, to.min === null ? null : toHHMM(to.min));
        },
      },
      d.point,
      moved,
    );
    if (started) setDrag({ ...d, over: targetAt(d.point, d) });
  };

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
            <View key={i} {...dropDay(toDateKey(days[i]))} style={{ flex: 1, gap: 2, paddingHorizontal: 2 }}>
              {items.map((n) => (
                <Pressable
                  key={n.id}
                  onPress={() => !justDragged() && onNotePress?.(n)}
                  {...mouseDraggable(`t:${n.id}`, (point) =>
                    startDrag({ key: n.id, label: n.text, color: n.color, from: n.date, note: n, grabMin: 0, durMin: 0, point }, true),
                  )}
                  onLongPress={(e) =>
                    startDrag({ key: n.id, label: n.text, color: n.color, from: n.date, note: n, grabMin: 0, durMin: 0, point: pointOf(e) })
                  }
                  delayLongPress={250}
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
            <View key={i} {...dropDay(toDateKey(days[i]))} style={{ flex: 1, gap: 2, paddingHorizontal: 2 }}>
              {items.slice(0, 3).map((o) => (
                <Pressable
                  key={o.key}
                  onPress={() => !justDragged() && onEventPress(o)}
                  {...mouseDraggable(`t:${o.key}`, (point) =>
                    startDrag(
                      {
                        key: o.key,
                        label: o.event.title,
                        color: occurrenceColor(o),
                        from: toDateKey(days[i]),
                        occurrence: o,
                        grabMin: 0,
                        durMin: 0,
                        point,
                      },
                      true,
                    ),
                  )}
                  onLongPress={(e) =>
                    startDrag({
                      key: o.key,
                      label: o.event.title,
                      color: occurrenceColor(o),
                      from: toDateKey(days[i]),
                      occurrence: o,
                      grabMin: 0,
                      durMin: 0,
                      point: pointOf(e),
                    })
                  }
                  delayLongPress={250}
                  accessibilityRole="button"
                  accessibilityLabel={`${o.event.title}, ${t('calendars.allDay')}`}
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: radius.xs,
                    backgroundColor: withAlpha(occurrenceColor(o), 0.22),
                    borderLeftWidth: 3,
                    borderLeftColor: o.calendar.color,
                  }}
                >
                  <AppText variant="caption" color={colors.text} numberOfLines={1}>
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
              <View
                key={key}
                {...dropDay(key, true)}
                style={{
                  flex: 1,
                  borderLeftWidth: 1,
                  borderLeftColor: colors.border,
                  backgroundColor: drag?.over?.day === key ? withAlpha(colors.primary, 0.05) : undefined,
                }}
              >
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
                  const c = occurrenceColor(p.occurrence);
                  const own = c !== p.occurrence.calendar.color;
                  return (
                    <Pressable
                      key={p.occurrence.key}
                      onPress={() => !justDragged() && onEventPress(p.occurrence)}
                      {...mouseDraggable(`t:${p.occurrence.key}`, (point, origin) => {
                        // Grab offset: where in the event the mouse went down.
                        const col = dropTargetAt(origin);
                        const grabbed = col ? ((origin.y - col.rect.top) / HOUR_HEIGHT) * 60 : p.startMin;
                        startDrag(
                          {
                            key: p.occurrence.key,
                            label: p.occurrence.event.title,
                            color: c,
                            from: key,
                            occurrence: p.occurrence,
                            grabMin: Math.max(0, grabbed - p.startMin),
                            durMin: p.endMin - p.startMin,
                            point,
                          },
                          true,
                        );
                      })}
                      onLongPress={(e) => {
                        const point = pointOf(e);
                        const col = dropTargetAt(point);
                        const grabbed = col ? ((point.y - col.rect.top) / HOUR_HEIGHT) * 60 : p.startMin;
                        startDrag({
                          key: p.occurrence.key,
                          label: p.occurrence.event.title,
                          color: c,
                          from: key,
                          occurrence: p.occurrence,
                          grabMin: Math.max(0, grabbed - p.startMin),
                          durMin: p.endMin - p.startMin,
                          point,
                        });
                      }}
                      delayLongPress={250}
                      accessibilityRole="button"
                      accessibilityLabel={`${formatTime(p.occurrence.start, locale)}, ${p.occurrence.event.title}, ${p.occurrence.calendar.name}`}
                      style={(s) => ({
                        position: 'absolute',
                        top,
                        height: h,
                        left: `${(p.column / p.columns) * 100}%`,
                        width: `${100 / p.columns}%`,
                        paddingRight: 2,
                        opacity: drag?.key === p.occurrence.key ? 0.35 : interaction(s).pressed ? 0.8 : 1,
                        userSelect: 'none',
                      })}
                    >
                      <View
                        style={{
                          flex: 1,
                          borderRadius: radius.sm,
                          borderLeftWidth: 3,
                          borderLeftColor: p.occurrence.calendar.color,
                          backgroundColor: withAlpha(c, own ? 0.34 : 0.16),
                          paddingHorizontal: 4,
                          paddingVertical: 2,
                          overflow: 'hidden',
                        }}
                      >
                        <AppText variant="caption" color={own ? colors.text : c} numberOfLines={h > 36 ? 2 : 1}>
                          {days.length > 1 ? shortShiftTitle(p.occurrence.event.title, t) : p.occurrence.event.title}
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
                {drag?.over?.day === key && drag.over.min !== null ? (
                  // Where the event will land.
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      left: 2,
                      right: 2,
                      top: (drag.over.min / 60) * HOUR_HEIGHT,
                      height: Math.max((drag.durMin / 60) * HOUR_HEIGHT - 2, 18),
                      borderRadius: radius.sm,
                      borderWidth: 2,
                      borderStyle: 'dashed',
                      borderColor: drag.color,
                      backgroundColor: withAlpha(drag.color, 0.12),
                      paddingHorizontal: 4,
                    }}
                  >
                    <AppText variant="caption" color={colors.text} style={{ fontSize: 10 }}>
                      {toHHMM(drag.over.min)}
                    </AppText>
                  </View>
                ) : null}
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
      {drag ? (
        <DragGhost
          point={drag.point}
          label={drag.label}
          color={drag.color}
          hint={
            drag.over
              ? `→ ${formatLongDate(new Date(`${drag.over.day}T12:00:00`), locale)}${drag.over.min !== null ? ` · ${toHHMM(drag.over.min)}` : ''}`
              : null
          }
        />
      ) : null}
    </View>
  );
}
