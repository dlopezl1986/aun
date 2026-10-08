import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { InfoNote } from '@/components/ui/InfoNote';
import { Sheet } from '@/components/ui/Sheet';
import { TextField } from '@/components/ui/TextField';
import { useLocale } from '@/hooks/useLocale';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';
import { parseTime, weekdayNames } from '@/utils/date';
import { useSaveActivities } from '../hooks';
import type { ActivityInput } from '../service';
import type { Member } from '../types';

function WeekdayPicker({ value, onChange, color }: { value: number[]; onChange: (v: number[]) => void; color: string }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { colors, radius } = useTheme();
  const names = weekdayNames(locale);
  return (
    <View style={{ flexDirection: 'row', gap: 4 }} accessibilityLabel={t('family.activities.days')}>
      {names.map((n, i) => {
        const on = value.includes(i);
        return (
          <Pressable
            key={n}
            onPress={() => onChange(on ? value.filter((d) => d !== i) : [...value, i])}
            accessibilityRole="checkbox"
            aria-checked={on}
            accessibilityLabel={n}
            style={{
              flex: 1,
              minHeight: 36,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: on ? color : colors.border,
              backgroundColor: on ? withAlpha(color, 0.18) : colors.surface,
            }}
          >
            <AppText variant="caption" color={on ? colors.text : colors.textMuted}>
              {n.slice(0, 2)}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function Editor({ member, onClose }: { member: Member; onClose: () => void }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const save = useSaveActivities();
  const [rows, setRows] = useState<ActivityInput[]>(() =>
    member.activities.length ? member.activities.map((a) => ({ ...a })) : [{ name: '', weekdays: [] }],
  );
  const patch = (i: number, p: Partial<ActivityInput>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const timeError = (v?: string | null) => (v && v.trim() && !parseTime(v) ? t('forms.invalidTime') : null);
  const invalid = rows.some((r) => timeError(r.startTime) || timeError(r.endTime));

  const submit = () => {
    if (invalid) return;
    const normalized = rows.map((r) => ({
      ...r,
      startTime: r.startTime?.trim() ? parseTime(r.startTime) : null,
      endTime: r.endTime?.trim() ? parseTime(r.endTime) : null,
    }));
    save.mutate({ memberId: member.id, activities: normalized }, { onSuccess: onClose });
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={t('family.activities.editTitle', { name: member.name })}
      footer={
        <>
          <Button label={t('common.cancel')} variant="ghost" onPress={onClose} />
          <Button label={t('common.save')} onPress={submit} disabled={invalid} loading={save.isPending} />
        </>
      }
    >
      <InfoNote title={t('family.activities.calendarTitle')} description={t('family.activities.calendarHint')} icon="calendar" />
      {rows.map((r, i) => (
        <Card key={r.id ?? `new-${i}`} style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <TextField
                compact
                value={r.name}
                onChangeText={(v) => patch(i, { name: v })}
                placeholder={t('family.activities.namePlaceholder')}
              />
            </View>
            <IconButton icon="trash-2" size={16} label={t('common.delete')} onPress={() => setRows(rows.filter((_, j) => j !== i))} />
          </View>
          <WeekdayPicker value={r.weekdays} onChange={(v) => patch(i, { weekdays: v })} color={member.color} />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <TextField
                compact
                value={r.startTime ?? ''}
                onChangeText={(v) => patch(i, { startTime: v })}
                placeholder={t('family.activities.from')}
                leftIcon="clock"
                error={timeError(r.startTime)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                compact
                value={r.endTime ?? ''}
                onChangeText={(v) => patch(i, { endTime: v })}
                placeholder={t('family.activities.to')}
                error={timeError(r.endTime)}
              />
            </View>
          </View>
          <TextField
            compact
            value={r.place ?? ''}
            onChangeText={(v) => patch(i, { place: v })}
            placeholder={t('family.activities.place')}
            leftIcon="map-pin"
          />
          <TextField
            compact
            value={r.notes ?? ''}
            onChangeText={(v) => patch(i, { notes: v })}
            placeholder={t('family.activities.notes')}
          />
        </Card>
      ))}
      <Button
        label={t('family.activities.add')}
        icon="plus"
        variant="secondary"
        onPress={() => setRows([...rows, { name: '', weekdays: [] }])}
        style={{ alignSelf: 'flex-start' }}
      />
    </Sheet>
  );
}

export function ActivitiesSheet({ member, onClose }: { member: Member | null; onClose: () => void }) {
  return member ? <Editor key={member.id} member={member} onClose={onClose} /> : null;
}
