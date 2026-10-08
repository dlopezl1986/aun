import { useMemo, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { interaction } from '@/components/ui/interaction';
import { useLocale } from '@/hooks/useLocale';
import { SurfaceScope, useTheme } from '@/theme';
import { addMonths, fromDateKey, monthMatrix, toDateKey, todayKey, weekdayNames, type DateKey } from '@/utils/date';

type View3 = 'days' | 'months' | 'years';

/** "marzo de 2027" → "Marzo de 2027" (only the first letter). */
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface Props {
  value: DateKey | null;
  onSelect: (key: DateKey) => void;
  onClose: () => void;
  title?: string;
}

/**
 * Small calendar to pick a date: days of the month, or tap the title to jump
 * to another month and year. Opens on top of any sheet.
 */
function Picker({ value, onSelect, onClose, title }: Props) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { colors, spacing, radius } = useTheme();
  const today = todayKey();
  const [month, setMonth] = useState(() => {
    const d = fromDateKey(value ?? today);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [mode, setMode] = useState<View3>('days');
  const weeks = useMemo(() => monthMatrix(month), [month]);
  const names = useMemo(() => weekdayNames(locale), [locale]);
  const monthNames = useMemo(
    () =>
      Array.from({ length: 12 }, (_, m) =>
        new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(2024, m, 1)).replace('.', ''),
      ),
    [locale],
  );
  const header =
    mode === 'days'
      ? capitalize(new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(month))
      : mode === 'months'
        ? String(month.getFullYear())
        : `${month.getFullYear() - 5} – ${month.getFullYear() + 6}`;

  const shift = (dir: -1 | 1) =>
    setMonth((m) => (mode === 'days' ? addMonths(m, dir) : new Date(m.getFullYear() + dir * (mode === 'years' ? 12 : 1), m.getMonth(), 1)));

  const cell =
    (selected: boolean, isToday: boolean, dim = false) =>
    ({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
      flex: 1,
      minHeight: 40,
      margin: 2,
      borderRadius: radius.md,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: selected ? colors.primary : pressed || hovered ? colors.primarySoft : 'transparent',
      borderWidth: isToday && !selected ? 1.5 : 0,
      borderColor: colors.primary,
      opacity: dim ? 0.45 : 1,
    });

  return (
    <View
      style={{
        width: '100%',
        maxWidth: 340,
        backgroundColor: colors.surface,
        borderRadius: radius.xl,
        padding: spacing.lg,
        gap: spacing.sm,
        boxShadow: `0px 12px 32px rgba(0,0,0,0.25)`,
      }}
      accessibilityViewIsModal
    >
      {title ? (
        <AppText variant="smallStrong" tone="textMuted">
          {title}
        </AppText>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <IconButton icon="chevron-left" label={t('forms.picker.previous')} onPress={() => shift(-1)} />
        <Pressable
          onPress={() => setMode(mode === 'days' ? 'months' : mode === 'months' ? 'years' : 'days')}
          accessibilityRole="button"
          accessibilityLabel={t('forms.picker.changeView', { label: header })}
          style={(s) => ({
            flex: 1,
            alignItems: 'center',
            paddingVertical: spacing.xs,
            borderRadius: radius.md,
            backgroundColor: interaction(s).hovered ? colors.surfaceMuted : 'transparent',
          })}
        >
          <AppText variant="bodyStrong">{header} ▾</AppText>
        </Pressable>
        <IconButton icon="chevron-right" label={t('forms.picker.next')} onPress={() => shift(1)} />
      </View>

      {mode === 'days' ? (
        <View>
          <View style={{ flexDirection: 'row' }}>
            {names.map((n) => (
              <View key={n} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
                <AppText variant="caption" tone="textSubtle">
                  {n}
                </AppText>
              </View>
            ))}
          </View>
          {weeks.map((week) => (
            <View key={toDateKey(week[0])} style={{ flexDirection: 'row' }}>
              {week.map((d) => {
                const key = toDateKey(d);
                const selected = key === value;
                const inMonth = d.getMonth() === month.getMonth();
                return (
                  <Pressable
                    key={key}
                    onPress={() => onSelect(key)}
                    accessibilityRole="button"
                    aria-selected={selected}
                    accessibilityLabel={new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(d)}
                    style={(s) => cell(selected, key === today, !inMonth)(interaction(s))}
                  >
                    <AppText variant="small" color={selected ? colors.onPrimary : colors.text}>
                      {d.getDate()}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      ) : mode === 'months' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {monthNames.map((n, m) => (
            <View key={n} style={{ width: '33.33%' }}>
              <Pressable
                onPress={() => {
                  setMonth(new Date(month.getFullYear(), m, 1));
                  setMode('days');
                }}
                accessibilityRole="button"
                accessibilityLabel={n}
                style={(s) => cell(m === month.getMonth(), false)(interaction(s))}
              >
                <AppText
                  variant="small"
                  color={m === month.getMonth() ? colors.onPrimary : colors.text}
                  style={{ textTransform: 'capitalize' }}
                >
                  {n}
                </AppText>
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {Array.from({ length: 12 }, (_, i) => month.getFullYear() - 5 + i).map((y) => (
            <View key={y} style={{ width: '33.33%' }}>
              <Pressable
                onPress={() => {
                  setMonth(new Date(y, month.getMonth(), 1));
                  setMode('months');
                }}
                accessibilityRole="button"
                accessibilityLabel={String(y)}
                style={(s) => cell(y === month.getFullYear(), y === new Date().getFullYear())(interaction(s))}
              >
                <AppText variant="small" color={y === month.getFullYear() ? colors.onPrimary : colors.text}>
                  {y}
                </AppText>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs }}>
        <Button label={t('common.today')} size="sm" variant="ghost" onPress={() => onSelect(today)} />
        <Button label={t('common.cancel')} size="sm" variant="ghost" onPress={onClose} />
      </View>
    </View>
  );
}

export function DatePickerPopup(props: Props & { visible: boolean }) {
  const { colors } = useTheme();
  if (!props.visible) return null;
  // Mounted only while open so it stacks above the sheet that contains the field.
  return (
    <Modal visible transparent animationType="fade" onRequestClose={props.onClose} statusBarTranslucent>
      <SurfaceScope>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <Pressable
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay }}
            onPress={props.onClose}
            accessibilityLabel={props.title}
          />
          <Picker {...props} />
        </View>
      </SurfaceScope>
    </Modal>
  );
}
