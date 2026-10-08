import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useDialog } from '@/components/feedback/DialogProvider';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Toggle } from '@/components/ui/Toggle';
import { withAlpha } from '@/utils/color';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { Sheet } from '@/components/ui/Sheet';
import { TextField } from '@/components/ui/TextField';
import { accentPalette, useTheme } from '@/theme';
import { useCreateCalendar, useDeleteCalendar, useDuplicateCalendar, useUpdateCalendar } from '../hooks';
import type { Calendar } from '../types';

/** Optional calendar icons (person, family, work, school…). */
export const CALENDAR_ICONS = ['user', 'users', 'heart', 'home', 'briefcase', 'book', 'award', 'activity', 'star', 'sun'];

interface Props {
  visible: boolean;
  onClose: () => void;
  /** When provided the sheet edits this calendar. */
  calendar?: Calendar | null;
}

function CalendarForm({ onClose, calendar }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const create = useCreateCalendar();
  const update = useUpdateCalendar();
  const del = useDeleteCalendar();
  const duplicate = useDuplicateCalendar();
  const dialog = useDialog();
  const [name, setName] = useState(calendar?.name ?? '');
  const [description, setDescription] = useState(calendar?.description ?? '');
  const [color, setColor] = useState<string>(calendar?.color ?? accentPalette[1]);
  const [icon, setIcon] = useState<string | null>(calendar?.icon ?? null);
  const [active, setActive] = useState(calendar?.isActive ?? true);

  const remove = async () => {
    if (!calendar) return;
    const ok = await dialog.confirm({
      title: t('calendars.deleteTitle', { name: calendar.name }),
      message: t('calendars.deleteMessage'),
      confirmLabel: t('common.delete'),
      destructive: true,
    });
    if (ok) del.mutate(calendar.id, { onSuccess: onClose });
  };

  const duplicateCal = async () => {
    if (!calendar) return;
    const newName = await dialog.prompt({
      title: t('calendars.duplicateCal.title', { name: calendar.name }),
      label: t('calendars.form.name'),
      initialValue: t('calendars.duplicateCal.copyName', { name: calendar.name }),
      confirmLabel: t('common.continue'),
    });
    if (!newName) return;
    const what = await dialog.choose({
      title: t('calendars.duplicateCal.whatTitle'),
      message: t('calendars.duplicateCal.whatMessage', { name: calendar.name }),
      choices: [
        { value: 'empty', label: t('calendars.duplicateCal.onlyCalendar') },
        { value: 'events', label: t('calendars.duplicateCal.withEvents') },
      ],
    });
    if (!what) return;
    duplicate.mutate({ id: calendar.id, name: newName, withEvents: what === 'events' }, { onSuccess: onClose });
  };

  const save = () => {
    if (!name.trim()) return;
    const done = { onSuccess: onClose };
    if (calendar) update.mutate({ id: calendar.id, patch: { name, description, color, icon, isActive: active } }, done);
    else create.mutate({ name, description, color, icon }, done);
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={calendar ? t('calendars.editCalendar') : t('calendars.newCalendar')}
      footer={
        <>
          {calendar ? <Button label={t('common.delete')} variant="ghost" icon="trash-2" onPress={() => void remove()} /> : null}
          {calendar ? (
            <Button
              label={t('calendars.duplicateCal.action')}
              variant="ghost"
              icon="copy"
              onPress={() => void duplicateCal()}
              loading={duplicate.isPending}
            />
          ) : null}
          <Button label={t('common.cancel')} variant="ghost" onPress={onClose} />
          <Button label={t('common.save')} onPress={save} disabled={!name.trim()} loading={create.isPending || update.isPending} />
        </>
      }
    >
      <TextField
        label={t('calendars.form.name')}
        placeholder={t('calendars.form.namePlaceholder')}
        value={name}
        onChangeText={setName}
        autoFocus
        onSubmitEditing={save}
      />
      <TextField
        label={t('calendars.form.description')}
        placeholder={t('common.optional')}
        value={description}
        onChangeText={setDescription}
      />
      <ColorPicker value={color} onChange={setColor} />
      <View style={{ gap: 8 }}>
        <AppText variant="smallStrong">{t('calendars.form.icon')}</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup">
          {[null, ...CALENDAR_ICONS].map((name) => {
            const selected = icon === name;
            return (
              <Pressable
                key={name ?? 'none'}
                onPress={() => setIcon(name)}
                accessibilityRole="radio"
                aria-checked={selected}
                accessibilityLabel={name ?? t('calendars.form.noIcon')}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? color : colors.border,
                  backgroundColor: selected ? withAlpha(color, 0.12) : 'transparent',
                }}
              >
                {name ? (
                  <Icon name={name as IconName} size={18} color={selected ? color : colors.textMuted} />
                ) : (
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
      {calendar ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong">{t('calendars.form.active')}</AppText>
            <AppText variant="small" tone="textMuted">
              {t('calendars.form.activeHint')}
            </AppText>
          </View>
          <Toggle value={active} onValueChange={setActive} label={t('calendars.form.active')} />
        </View>
      ) : null}
    </Sheet>
  );
}

/** The form mounts only while open, so its state starts fresh every time. */
export function CalendarFormSheet(props: Props) {
  return props.visible ? <CalendarForm {...props} /> : null;
}
