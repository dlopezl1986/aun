import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LinkChips } from '@/components/links/LinkChips';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { useLocale } from '@/hooks/useLocale';
import { useTheme } from '@/theme';
import { addDays, formatLongDate, formatTime, isSameDay, toDateKey } from '@/utils/date';
import { describeRecurrence, describeReminder } from '@/utils/recurrenceText';
import { useDeleteEvent, useDuplicateEvent } from '../hooks';
import { eventLinks } from '../service';
import type { CalendarEvent, EventOccurrence } from '../types';

interface Props {
  occurrence: EventOccurrence | null;
  onClose: () => void;
  onEdit: (event: CalendarEvent) => void;
}

function Row({ icon, children }: { icon: IconName; children: React.ReactNode }) {
  const { spacing, colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
      <View style={{ paddingTop: 2 }}>
        <Icon name={icon} size={16} color={colors.textMuted} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>{children}</View>
    </View>
  );
}

/** Human "when" line: handles all-day, multi-day and timed events. */
export function useWhenLabel(o: EventOccurrence): string {
  const { t } = useTranslation();
  const locale = useLocale();
  if (o.event.allDay) {
    const last = addDays(o.end, -1);
    return isSameDay(o.start, last)
      ? `${formatLongDate(o.start, locale)} · ${t('calendars.allDay')}`
      : `${formatLongDate(o.start, locale)} – ${formatLongDate(last, locale)}`;
  }
  if (isSameDay(o.start, o.end))
    return `${formatLongDate(o.start, locale)} · ${formatTime(o.start, locale)} – ${formatTime(o.end, locale)}`;
  return `${formatLongDate(o.start, locale)} ${formatTime(o.start, locale)} – ${formatLongDate(o.end, locale)} ${formatTime(o.end, locale)}`;
}

function Detail({
  occurrence: o,
  onClose,
  onEdit,
}: {
  occurrence: EventOccurrence;
  onClose: () => void;
  onEdit: (e: CalendarEvent) => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { spacing } = useTheme();
  const del = useDeleteEvent();
  const duplicate = useDuplicateEvent();
  const [confirming, setConfirming] = useState(false);
  const { event, calendar } = o;
  const recurring = !!event.recurrence;
  const when = useWhenLabel(o);
  const links = eventLinks(event);

  const remove = (scope: 'one' | 'all') =>
    del.mutate({ id: event.id, date: scope === 'one' ? toDateKey(o.start) : undefined }, { onSuccess: onClose });

  return (
    <Sheet
      visible
      onClose={onClose}
      title={event.title}
      footer={
        confirming ? (
          <View style={{ flex: 1, gap: spacing.sm }}>
            <AppText variant="smallStrong">{recurring ? t('calendars.deleteRecurringTitle') : t('calendars.deleteEventTitle')}</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'flex-end' }}>
              <Button label={t('common.cancel')} variant="ghost" onPress={() => setConfirming(false)} />
              {recurring ? (
                <Button label={t('calendars.deleteThisOne')} variant="secondary" onPress={() => remove('one')} loading={del.isPending} />
              ) : null}
              <Button
                label={recurring ? t('calendars.deleteSeries') : t('common.delete')}
                variant="danger"
                onPress={() => remove('all')}
                loading={del.isPending}
              />
            </View>
          </View>
        ) : (
          <>
            <Button label={t('common.delete')} variant="ghost" icon="trash-2" onPress={() => setConfirming(true)} />
            <Button
              label={t('calendars.duplicate')}
              variant="secondary"
              icon="copy"
              onPress={() => duplicate.mutate(event.id, { onSuccess: onClose })}
            />
            <Button label={t('common.edit')} icon="edit-2" onPress={() => onEdit(event)} />
          </>
        )
      }
    >
      <Badge label={calendar.name} color={calendar.color} icon={(calendar.icon as IconName) || 'calendar'} />
      <Row icon="clock">
        <AppText variant="bodyStrong">{when}</AppText>
        {recurring ? (
          <AppText variant="small" tone="textMuted">
            {describeRecurrence(event.recurrence, t, locale)}
          </AppText>
        ) : null}
      </Row>
      {event.location ? (
        <Row icon="map-pin">
          <AppText variant="body">{event.location}</AppText>
        </Row>
      ) : null}
      {event.participants.length ? (
        <Row icon="users">
          <AppText variant="body">{event.participants.join(', ')}</AppText>
        </Row>
      ) : null}
      {event.reminders.length ? (
        <Row icon="bell">
          <AppText variant="body">{event.reminders.map((m) => describeReminder(m, t)).join(' · ')}</AppText>
        </Row>
      ) : null}
      {event.description ? (
        <Row icon="align-left">
          <AppText variant="body">{event.description}</AppText>
        </Row>
      ) : null}
      {event.notes ? (
        <Row icon="edit-3">
          <AppText variant="body" tone="textMuted">
            {event.notes}
          </AppText>
        </Row>
      ) : null}
      {links.length ? (
        <Row icon="paperclip">
          <LinkChips refs={links} openable onOpen={onClose} />
        </Row>
      ) : null}
    </Sheet>
  );
}

export function EventDetailSheet({ occurrence, onClose, onEdit }: Props) {
  return occurrence ? <Detail occurrence={occurrence} onClose={onClose} onEdit={onEdit} /> : null;
}
