import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { DateField, TimeField } from '@/components/forms/DateTimeFields';
import { RecurrenceEditor } from '@/components/forms/RecurrenceEditor';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { TextField } from '@/components/ui/TextField';
import { useTheme } from '@/theme';
import type { RecurrenceRule } from '@/types/recurrence';
import { timeOf, toDateKey, todayKey } from '@/utils/date';
import { useCreateReminder, useUpdateReminder } from '../hooks';
import type { Reminder } from '../types';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Edit mode when provided. */
  reminder?: Reminder | null;
}

function ReminderForm({ onClose, reminder }: Props) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const create = useCreateReminder();
  const update = useUpdateReminder();
  const at = reminder ? new Date(reminder.at) : null;
  const [title, setTitle] = useState(reminder?.title ?? '');
  const [date, setDate] = useState(() => (at ? toDateKey(at) : todayKey()));
  const [time, setTime] = useState(at ? timeOf(at) : '18:00');
  const [recurrence, setRecurrence] = useState<RecurrenceRule | null>(reminder?.recurrence ?? null);
  const [valid, setValid] = useState({ date: true, time: true });

  const canSave = !!title.trim() && valid.date && valid.time;
  const save = () => {
    if (!canSave) return;
    const input = { title, date, time, recurrence };
    if (reminder) update.mutate({ id: reminder.id, input }, { onSuccess: onClose });
    else create.mutate(input, { onSuccess: onClose });
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={reminder ? t('notifications.editReminder') : t('notifications.newReminder')}
      footer={
        <>
          <Button label={t('common.cancel')} variant="ghost" onPress={onClose} />
          <Button label={t('common.save')} onPress={save} disabled={!canSave} loading={create.isPending || update.isPending} />
        </>
      }
    >
      <TextField
        label={t('notifications.form.title')}
        placeholder={t('notifications.form.titlePlaceholder')}
        value={title}
        onChangeText={setTitle}
        autoFocus={!reminder}
      />
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <DateField
            label={t('notifications.form.date')}
            value={date}
            onChange={setDate}
            onValidityChange={(v) => setValid((s) => ({ ...s, date: v }))}
          />
        </View>
        <View style={{ flex: 1 }}>
          <TimeField
            label={t('notifications.form.time')}
            value={time}
            onChange={setTime}
            onValidityChange={(v) => setValid((s) => ({ ...s, time: v }))}
          />
        </View>
      </View>
      <View style={{ gap: spacing.sm }}>
        <AppText variant="smallStrong" tone="textMuted">
          {t('notifications.form.repeat')}
        </AppText>
        <RecurrenceEditor value={recurrence} onChange={setRecurrence} startDate={date} />
      </View>
    </Sheet>
  );
}

/** The form mounts only while open, so its state starts fresh every time. */
export function ReminderFormSheet(props: Props) {
  return props.visible ? <ReminderForm {...props} /> : null;
}
