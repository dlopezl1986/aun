import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { IconButton } from '@/components/ui/IconButton';
import { useLocale } from '@/hooks/useLocale';
import { useTheme } from '@/theme';
import { formatTime } from '@/utils/date';
import { occurrenceColor, type EventOccurrence } from '../types';

interface EventRowProps {
  occurrence: EventOccurrence;
  onDelete?: (o: EventOccurrence) => void;
}

export function EventRow({ occurrence, onDelete }: EventRowProps) {
  const { spacing, radius } = useTheme();
  const locale = useLocale();
  const { t } = useTranslation();
  const { event, calendar, start, end } = occurrence;
  const when = event.allDay ? t('calendars.allDay') : `${formatTime(start, locale)} – ${formatTime(end, locale)}`;
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, minHeight: 48 }}
      accessibilityLabel={`${when}, ${event.title}, ${calendar.name}`}
    >
      <View style={{ width: 4, alignSelf: 'stretch', borderRadius: radius.pill, backgroundColor: occurrenceColor(occurrence) }} />
      <View style={{ width: 92 }}>
        <AppText variant="smallStrong" tone="textMuted">
          {event.allDay ? t('calendars.allDay') : formatTime(start, locale)}
        </AppText>
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {event.title}
        </AppText>
        <AppText variant="small" tone="textMuted" numberOfLines={1}>
          {[calendar.name, event.location].filter(Boolean).join(' · ')}
        </AppText>
      </View>
      {onDelete ? <IconButton icon="trash-2" size={16} label={t('common.delete')} onPress={() => onDelete(occurrence)} /> : null}
    </View>
  );
}
