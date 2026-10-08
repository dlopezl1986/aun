import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/Badge';
import { Checkbox } from '@/components/ui/Checkbox';
import { IconButton } from '@/components/ui/IconButton';
import { useLocale } from '@/hooks/useLocale';
import { formatShortDate, formatTime, isSameDay } from '@/utils/date';
import { describeRecurrence } from '@/utils/recurrenceText';
import type { Reminder } from '../types';

interface Props {
  reminder: Reminder;
  onToggle: (r: Reminder) => void;
  onSnooze?: (r: Reminder) => void;
  onEdit?: (r: Reminder) => void;
  onDelete?: (r: Reminder) => void;
}

export function ReminderRow({ reminder, onToggle, onSnooze, onEdit, onDelete }: Props) {
  const { t } = useTranslation();
  const locale = useLocale();
  const at = new Date(reminder.at);
  const now = new Date();
  const overdue = !reminder.done && at.getTime() <= now.getTime();
  const label = `${isSameDay(at, now) ? t('common.today') : formatShortDate(at, locale)} · ${formatTime(at, locale)}`;
  return (
    <Checkbox
      completedStyle
      checked={reminder.done}
      onChange={() => onToggle(reminder)}
      label={reminder.title}
      description={reminder.recurrence ? describeRecurrence(reminder.recurrence, t, locale) : undefined}
      right={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Badge label={label} tone={overdue ? 'danger' : 'info'} icon={reminder.recurrence ? 'repeat' : 'clock'} />
          {onSnooze && overdue ? (
            <IconButton
              icon="clock"
              size={16}
              label={`${t('notifications.snooze')}: ${reminder.title}`}
              onPress={() => onSnooze(reminder)}
            />
          ) : null}
          {onEdit ? (
            <IconButton icon="edit-2" size={16} label={`${t('common.edit')}: ${reminder.title}`} onPress={() => onEdit(reminder)} />
          ) : null}
          {onDelete ? (
            <IconButton icon="trash-2" size={16} label={`${t('common.delete')}: ${reminder.title}`} onPress={() => onDelete(reminder)} />
          ) : null}
        </View>
      }
    />
  );
}
