import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { interaction } from '@/components/ui/interaction';
import { EmptyState } from '@/components/ui/States';
import { useLocale } from '@/hooks/useLocale';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';
import { formatShortDate, formatTime } from '@/utils/date';
import { useUpdateDayNote } from '../hooks';
import { calendarsMeta } from '../meta';
import { isMultiDay } from '../monthLayout';
import { occurrenceColor, type DayNote, type EventOccurrence } from '../types';

/** A sticky note: tick it off, tap it to edit. */
export function NoteCard({ note, onPress }: { note: DayNote; onPress: (n: DayNote) => void }) {
  const { t } = useTranslation();
  const { spacing, radius, colors } = useTheme();
  const update = useUpdateDayNote();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
        padding: spacing.sm,
        paddingLeft: spacing.xs,
        borderRadius: radius.md,
        backgroundColor: withAlpha(note.color, 0.22),
        borderLeftWidth: 4,
        borderLeftColor: note.color,
        opacity: note.done ? 0.6 : 1,
      }}
    >
      <Pressable
        onPress={() => update.mutate({ id: note.id, patch: { done: !note.done } })}
        accessibilityRole="checkbox"
        aria-checked={note.done}
        accessibilityLabel={note.text}
        hitSlop={8}
        style={{ padding: 4 }}
      >
        <Icon name={note.done ? 'check-square' : 'square'} size={18} color={colors.textMuted} />
      </Pressable>
      <Pressable
        onPress={() => onPress(note)}
        accessibilityRole="button"
        accessibilityHint={t('calendars.notes.edit')}
        style={(s) => ({ flex: 1, gap: 2, opacity: interaction(s).pressed ? 0.6 : 1 })}
      >
        <AppText variant="body" style={note.done ? { textDecorationLine: 'line-through' } : undefined}>
          {note.text}
        </AppText>
        {note.remindAt ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="bell" size={12} color={colors.textMuted} />
            <AppText variant="caption" tone="textMuted">
              {note.remindAt}
            </AppText>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

/** When an occurrence happens, readable: "Todo el día", "10:00 – 11:30", or its days if it lasts several. */
export function useWhen() {
  const { t } = useTranslation();
  const locale = useLocale();
  return ({ event, start, end }: EventOccurrence) => {
    if (isMultiDay({ start, end })) {
      const last = new Date(end.getTime() - 1);
      return event.allDay
        ? `${formatShortDate(start, locale)} – ${formatShortDate(last, locale)}`
        : `${formatShortDate(start, locale)} ${formatTime(start, locale)} – ${formatShortDate(end, locale)} ${formatTime(end, locale)}`;
    }
    return event.allDay ? t('calendars.allDay') : `${formatTime(start, locale)} – ${formatTime(end, locale)}`;
  };
}

/**
 * An event in the day list: its name, big and readable; the time small and the calendar as colour.
 * `extended` (day pop-up) adds the calendar, place, description and notes.
 */
export function EventCard({
  occurrence,
  onPress,
  extended = false,
}: {
  occurrence: EventOccurrence;
  onPress: (o: EventOccurrence) => void;
  extended?: boolean;
}) {
  const { spacing, radius, colors } = useTheme();
  const { event, calendar } = occurrence;
  const when = useWhen()(occurrence);
  const fill = occurrenceColor(occurrence);
  const own = fill !== calendar.color;
  return (
    <Pressable
      onPress={() => onPress(occurrence)}
      accessibilityRole="button"
      accessibilityLabel={`${when}, ${event.title}, ${calendar.name}`}
      style={(s) => ({
        flexDirection: 'row',
        borderRadius: radius.md,
        overflow: 'hidden',
        backgroundColor: withAlpha(fill, (own ? 0.26 : 0.11) + (interaction(s).hovered ? 0.07 : 0)),
        opacity: interaction(s).pressed ? 0.7 : 1,
      })}
    >
      <View style={{ width: 5, backgroundColor: calendar.color }} />
      <View style={{ flex: 1, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, gap: 2 }}>
        <AppText variant="caption" tone="textMuted">
          {when}
        </AppText>
        <AppText variant="bodyStrong">{event.title}</AppText>
        {extended ? (
          <View style={{ gap: 4, marginTop: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: calendar.color }} />
              <AppText variant="caption" tone="textMuted">
                {calendar.name}
              </AppText>
            </View>
            {event.location ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name="map-pin" size={12} color={colors.textMuted} />
                <AppText variant="caption" tone="textMuted">
                  {event.location}
                </AppText>
              </View>
            ) : null}
            {event.description ? (
              <AppText variant="small" numberOfLines={4}>
                {event.description}
              </AppText>
            ) : null}
            {event.notes ? (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                <Icon name="file-text" size={12} color={colors.textMuted} />
                <AppText variant="small" tone="textMuted" numberOfLines={4} style={{ flex: 1 }}>
                  {event.notes}
                </AppText>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

interface DayAgendaProps {
  occurrences: EventOccurrence[];
  notes: DayNote[];
  onEvent: (o: EventOccurrence) => void;
  onNote: (n: DayNote | null) => void;
  onNewEvent: () => void;
  /** Cards with every detail (the day pop-up). */
  extended?: boolean;
}

/** Everything on one day, readable at a glance: notes first, then each event as a card. */
export function DayAgenda({ occurrences, notes, onEvent, onNote, onNewEvent, extended = false }: DayAgendaProps) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Icon name="bookmark" size={16} color={calendarsMeta.accent} />
          <AppText variant="smallStrong" tone="textMuted" style={{ flex: 1 }}>
            {t('calendars.notes.title')}
          </AppText>
          <Button label={t('calendars.notes.add')} icon="plus" size="sm" variant="ghost" onPress={() => onNote(null)} />
        </View>
        {notes.length ? (
          notes.map((n) => <NoteCard key={n.id} note={n} onPress={onNote} />)
        ) : (
          <AppText variant="caption" tone="textSubtle">
            {t('calendars.notes.empty')}
          </AppText>
        )}
      </View>
      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Icon name="calendar" size={16} color={calendarsMeta.accent} />
          <AppText variant="smallStrong" tone="textMuted" style={{ flex: 1 }}>
            {t('calendars.dayEvents', { count: occurrences.length })}
          </AppText>
          <Button label={t('calendars.addToDay')} icon="plus" size="sm" variant="ghost" onPress={onNewEvent} />
        </View>
        {occurrences.length ? (
          occurrences.map((o) => <EventCard key={o.key} occurrence={o} onPress={onEvent} extended={extended} />)
        ) : (
          <EmptyState compact icon="sun" accent={calendarsMeta.accent} title={t('calendars.noEventsDay')} />
        )}
      </View>
    </View>
  );
}
