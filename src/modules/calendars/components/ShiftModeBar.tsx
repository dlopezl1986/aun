import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ChipGroup } from '@/components/forms/Chips';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { interaction } from '@/components/ui/interaction';
import { useLocale } from '@/hooks/useLocale';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';
import type { Calendar, ShiftType } from '../types';
import { shiftHoursLabel } from './ShiftTypesSheet';

/** What a tap on a day does: paint this shift label, or erase. */
export type ShiftBrush = { kind: 'shift'; type: ShiftType } | { kind: 'erase' };

interface Props {
  types: ShiftType[];
  brush: ShiftBrush | null;
  onBrush: (b: ShiftBrush) => void;
  calendars: Calendar[];
  calendarId: string | null;
  onCalendar: (id: string) => void;
  changes: number;
  /** Hours of the shifts this month in the chosen calendar ("97,5 h"), if any. */
  monthHours: string | null;
  canUndo: boolean;
  onUndo: () => void;
  onManage: () => void;
  onDone: () => void;
}

/**
 * Shift mode (like Shifter): pick a shift label, tap days on the month to add
 * it (tap again to remove), or pick the eraser. Every tap is saved at once;
 * "Listo" leaves the mode.
 */
export function ShiftModeBar({
  types,
  brush,
  onBrush,
  calendars,
  calendarId,
  onCalendar,
  changes,
  monthHours,
  canUndo,
  onUndo,
  onManage,
  onDone,
}: Props) {
  const { t } = useTranslation();
  const { spacing, colors, radius } = useTheme();
  const locale = useLocale();
  const chip = (
    key: string,
    label: string,
    sub: string | null,
    color: string | null,
    active: boolean,
    onPress: () => void,
    icon?: 'delete',
  ) => (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole="radio"
      aria-checked={active}
      accessibilityLabel={sub ? `${label}, ${sub}` : label}
      style={(s) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
        paddingHorizontal: spacing.md,
        borderRadius: radius.pill,
        borderWidth: 2,
        borderColor: active ? (color ?? colors.danger) : colors.border,
        backgroundColor: color ? withAlpha(color, active ? 0.35 : 0.14) : active ? withAlpha(colors.danger, 0.14) : 'transparent',
        opacity: interaction(s).pressed ? 0.7 : 1,
      })}
    >
      {icon ? (
        <Icon name={icon} size={16} color={colors.danger} />
      ) : (
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color! }} />
      )}
      <View>
        <AppText variant="smallStrong">{label}</AppText>
        {sub ? (
          <AppText variant="caption" tone="textMuted" style={{ fontSize: 10, lineHeight: 12 }}>
            {sub}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
  return (
    <View
      style={{
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: withAlpha(colors.primary, 0.08),
        borderWidth: 1,
        borderColor: withAlpha(colors.primary, 0.3),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name="briefcase" size={18} color={colors.primary} />
        <AppText variant="bodyStrong" style={{ flex: 1 }}>
          {t('calendars.shiftMode.title')}
          {monthHours ? (
            <AppText variant="small" tone="primary">
              {`  ·  ${t('calendars.shiftHours.thisMonth', { hours: monthHours })}`}
            </AppText>
          ) : null}
        </AppText>
        <IconButton icon="rotate-ccw" label={t('calendars.shiftMode.undo')} onPress={onUndo} disabled={!canUndo} />
        <IconButton icon="settings" label={t('calendars.shiftMode.manage')} onPress={onManage} />
        <Button
          label={changes ? t('calendars.shiftMode.doneCount', { count: changes }) : t('calendars.shiftMode.done')}
          icon="check"
          size="sm"
          onPress={onDone}
        />
      </View>
      <AppText variant="caption" tone="textMuted">
        {brush
          ? t(brush.kind === 'erase' ? 'calendars.shiftMode.hintErase' : 'calendars.shiftMode.hintPaint')
          : t('calendars.shiftMode.hintPick')}
      </AppText>
      {calendars.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
          <ChipGroup<string>
            compact
            accessibilityLabel={t('calendars.shiftMode.calendar')}
            selected={calendarId ?? ''}
            onToggle={onCalendar}
            options={calendars.map((c) => ({ value: c.id, label: c.name }))}
          />
        </ScrollView>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
        <View
          style={{ flexDirection: 'row', gap: spacing.sm }}
          accessibilityRole="radiogroup"
          accessibilityLabel={t('calendars.shiftMode.title')}
        >
          {types.map((s) =>
            chip(
              s.id,
              s.name,
              shiftHoursLabel(s, t('calendars.allDay'), locale),
              s.color,
              brush?.kind === 'shift' && brush.type.id === s.id,
              () => onBrush({ kind: 'shift', type: s }),
            ),
          )}
          {chip('erase', t('calendars.shiftMode.erase'), null, null, brush?.kind === 'erase', () => onBrush({ kind: 'erase' }), 'delete')}
        </View>
      </ScrollView>
    </View>
  );
}
