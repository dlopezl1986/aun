import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useDialog } from '@/components/feedback/DialogProvider';
import { TimeField } from '@/components/forms/DateTimeFields';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Sheet } from '@/components/ui/Sheet';
import { TextField } from '@/components/ui/TextField';
import { Toggle } from '@/components/ui/Toggle';
import { accentPalette, useTheme } from '@/theme';
import { useDeleteShiftType, useSaveShiftType } from '../hooks';
import type { ShiftTypeInput } from '../shiftTypes';
import type { ShiftType } from '../types';

/** "07:00 – 15:00" or "Todo el día". */
export function shiftHoursLabel(s: Pick<ShiftType, 'allDay' | 'start' | 'end'>, allDay: string): string {
  return s.allDay ? allDay : `${s.start} – ${s.end}`;
}

function Form({ initial, onDone }: { initial: ShiftType | null; onDone: () => void }) {
  const { t } = useTranslation();
  const { spacing, colors, radius } = useTheme();
  const save = useSaveShiftType();
  const [value, setValue] = useState<ShiftTypeInput>(
    initial
      ? { name: initial.name, color: initial.color, allDay: initial.allDay, start: initial.start, end: initial.end }
      : { name: '', color: accentPalette[4], allDay: false, start: '09:00', end: '17:00' },
  );
  const set = (patch: Partial<ShiftTypeInput>) => setValue((v) => ({ ...v, ...patch }));
  return (
    <View style={{ gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceMuted }}>
      <TextField
        label={t('calendars.shiftMode.name')}
        value={value.name}
        onChangeText={(name) => set({ name })}
        placeholder={t('calendars.shiftMode.namePlaceholder')}
        autoFocus
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }} accessibilityRole="radiogroup">
        {accentPalette.map((c) => (
          <Pressable
            key={c}
            onPress={() => set({ color: c })}
            accessibilityRole="radio"
            aria-checked={value.color === c}
            accessibilityLabel={c}
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: c,
              borderWidth: value.color === c ? 3 : 0,
              borderColor: colors.text,
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <AppText variant="bodyStrong" style={{ flex: 1 }}>
          {t('calendars.allDay')}
        </AppText>
        <Toggle value={value.allDay} onValueChange={(allDay) => set({ allDay })} label={t('calendars.allDay')} />
      </View>
      {value.allDay ? null : (
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <TimeField label={t('calendars.shiftMode.start')} value={value.start} onChange={(start) => set({ start })} />
          </View>
          <View style={{ flex: 1 }}>
            <TimeField label={t('calendars.shiftMode.end')} value={value.end} onChange={(end) => set({ end })} />
          </View>
        </View>
      )}
      {!value.allDay && value.end <= value.start ? (
        <AppText variant="caption" tone="textMuted">
          {t('calendars.shiftMode.overnight')}
        </AppText>
      ) : null}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm }}>
        <Button label={t('common.cancel')} variant="ghost" size="sm" onPress={onDone} />
        <Button
          label={t('common.save')}
          icon="check"
          size="sm"
          disabled={!value.name.trim()}
          loading={save.isPending}
          onPress={() => save.mutate({ id: initial?.id ?? null, input: value }, { onSuccess: onDone })}
        />
      </View>
    </View>
  );
}

/** Create, edit and delete the shift labels used in shift mode. */
export function ShiftTypesSheet({ visible, types, onClose }: { visible: boolean; types: ShiftType[]; onClose: () => void }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const dialog = useDialog();
  const del = useDeleteShiftType();
  const [editing, setEditing] = useState<ShiftType | 'new' | null>(null);
  if (!visible) return null;
  return (
    <Sheet visible onClose={onClose} title={t('calendars.shiftMode.manage')} subtitle={t('calendars.shiftMode.manageHint')}>
      {types.map((s) =>
        editing !== 'new' && editing?.id === s.id ? (
          <Form key={s.id} initial={s} onDone={() => setEditing(null)} />
        ) : (
          <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48 }}>
            <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: s.color }} />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">{s.name}</AppText>
              <AppText variant="caption" tone="textMuted">
                {shiftHoursLabel(s, t('calendars.allDay'))}
              </AppText>
            </View>
            <IconButton icon="edit-2" size={16} label={`${t('common.edit')}: ${s.name}`} onPress={() => setEditing(s)} />
            <IconButton
              icon="trash-2"
              size={16}
              label={`${t('common.delete')}: ${s.name}`}
              onPress={async () => {
                const ok = await dialog.confirm({
                  title: t('calendars.shiftMode.deleteTitle', { name: s.name }),
                  message: t('calendars.shiftMode.deleteMessage'),
                  confirmLabel: t('common.delete'),
                  destructive: true,
                });
                if (ok) del.mutate(s.id);
              }}
            />
          </View>
        ),
      )}
      {editing === 'new' ? (
        <Form initial={null} onDone={() => setEditing(null)} />
      ) : (
        <Button label={t('calendars.shiftMode.new')} icon="plus" variant="secondary" onPress={() => setEditing('new')} />
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        <Icon name="info" size={14} />
        <AppText variant="caption" tone="textMuted" style={{ flex: 1 }}>
          {t('calendars.shiftMode.manageNote')}
        </AppText>
      </View>
    </Sheet>
  );
}
