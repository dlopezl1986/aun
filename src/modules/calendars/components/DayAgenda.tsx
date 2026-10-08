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
import { formatTime } from '@/utils/date';
import { useUpdateDayNote } from '../hooks';
import { calendarsMeta } from '../meta';
import type { DayNote, EventOccurrence } from '../types';

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

/** An event in the day list: its name, big and readable; the time small and the calendar as colour. */
export function EventCard({ occurrence, onPress }: { occurrence: EventOccurrence; onPress: (o: EventOccurrence) => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { spacing, radius } = useTheme();
  const { event, calendar, start, end } = occurrence;
  const when = event.allDay ? t('calendars.allDay') : `${formatTime(start, locale)} – ${formatTime(end, locale)}`;
  return (
    <Pressable
      onPress={() => onPress(occurrence)}
      accessibilityRole="button"
      accessibilityLabel={`${when}, ${event.title}, ${calendar.name}`}
      style={(s) => ({
        flexDirection: 'row',
        borderRadius: radius.md,
        overflow: 'hidden',
        backgroundColor: withAlpha(calendar.color, interaction(s).hovered ? 0.18 : 0.11),
        opacity: interaction(s).pressed ? 0.7 : 1,
      })}
    >
      <View style={{ width: 5, backgroundColor: calendar.color }} />
      <View style={{ flex: 1, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, gap: 2 }}>
        <AppText variant="caption" tone="textMuted">
          {when}
        </AppText>
        <AppText variant="bodyStrong">{event.title}</AppText>
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
}

/** Everything on one day, readable at a glance: notes first, then each event as a card. */
export function DayAgenda({ occurrences, notes, onEvent, onNote, onNewEvent }: DayAgendaProps) {
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
          occurrences.map((o) => <EventCard key={o.key} occurrence={o} onPress={onEvent} />)
        ) : (
          <EmptyState compact icon="sun" accent={calendarsMeta.accent} title={t('calendars.noEventsDay')} />
        )}
      </View>
    </View>
  );
}
