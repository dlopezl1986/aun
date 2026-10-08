import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { DateField, TimeField } from '@/components/forms/DateTimeFields';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { TextField } from '@/components/ui/TextField';
import { Toggle } from '@/components/ui/Toggle';
import { useTheme } from '@/theme';
import type { DateKey } from '@/utils/date';
import { useAddDayNote, useRemoveDayNote, useUpdateDayNote } from '../hooks';
import { NOTE_COLORS, type DayNote } from '../types';

interface Props {
  /** `null` = closed. */
  target: { date: DateKey; note: DayNote | null } | null;
  onClose: () => void;
}

function Editor({ date: initialDate, note, onClose }: { date: DateKey; note: DayNote | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { spacing, colors } = useTheme();
  const add = useAddDayNote();
  const update = useUpdateDayNote();
  const remove = useRemoveDayNote();
  const [text, setText] = useState(note?.text ?? '');
  const [date, setDate] = useState<DateKey>(note?.date ?? initialDate);
  const [color, setColor] = useState(note?.color ?? NOTE_COLORS[0]);
  const [remind, setRemind] = useState(Boolean(note?.remindAt));
  const [remindAt, setRemindAt] = useState(note?.remindAt ?? '09:00');
  const [timeValid, setTimeValid] = useState(true);
  const [dateValid, setDateValid] = useState(true);

  const canSave = Boolean(text.trim()) && dateValid && (!remind || timeValid);
  const save = () => {
    if (!canSave) return;
    const input = { date, text, color, remindAt: remind ? remindAt : null };
    if (note) update.mutate({ id: note.id, patch: input }, { onSuccess: onClose });
    else add.mutate(input, { onSuccess: onClose });
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={note ? t('calendars.notes.edit') : t('calendars.notes.new')}
      footer={
        <>
          {note ? (
            <Button
              label={t('common.delete')}
              icon="trash-2"
              variant="ghost"
              onPress={() => remove.mutate(note.id, { onSuccess: onClose })}
            />
          ) : null}
          <View style={{ flex: 1 }} />
          <Button label={t('common.cancel')} variant="ghost" onPress={onClose} />
          <Button label={t('common.save')} onPress={save} disabled={!canSave} loading={add.isPending || update.isPending} />
        </>
      }
    >
      <AppText variant="small" tone="textMuted">
        {t('calendars.notes.hint')}
      </AppText>
      <TextField
        label={t('calendars.notes.text')}
        value={text}
        onChangeText={setText}
        placeholder={t('calendars.notes.placeholder')}
        multiline
        autoFocus={!note}
      />
      <DateField label={t('calendars.notes.day')} value={date} onChange={setDate} onValidityChange={setDateValid} />
      <View style={{ gap: spacing.sm }}>
        <AppText variant="smallStrong" tone="textMuted">
          {t('calendars.notes.color')}
        </AppText>
        <View style={{ flexDirection: 'row', gap: spacing.sm }} accessibilityRole="radiogroup">
          {NOTE_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              accessibilityRole="radio"
              aria-checked={c === color}
              accessibilityLabel={c}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: c,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: c === color ? 2 : 0,
                borderColor: colors.text,
              }}
            >
              {c === color ? <Icon name="check" size={16} color="#1F2937" /> : null}
            </Pressable>
          ))}
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong">{t('calendars.notes.remind')}</AppText>
          <AppText variant="caption" tone="textMuted">
            {t('calendars.notes.remindHint')}
          </AppText>
        </View>
        <Toggle value={remind} onValueChange={setRemind} label={t('calendars.notes.remind')} />
      </View>
      {remind ? (
        <TimeField label={t('calendars.notes.remindAt')} value={remindAt} onChange={setRemindAt} onValidityChange={setTimeValid} />
      ) : null}
    </Sheet>
  );
}

/** Create / edit a day note (sticky-note reminder pinned to a day). */
export function DayNoteSheet({ target, onClose }: Props) {
  return target ? <Editor key={target.note?.id ?? `new-${target.date}`} date={target.date} note={target.note} onClose={onClose} /> : null;
}
