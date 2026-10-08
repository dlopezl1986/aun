import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { TextField } from '@/components/ui/TextField';
import { useLocale } from '@/hooks/useLocale';
import { useTheme } from '@/theme';
import type { RecurrenceFrequency, RecurrenceRule } from '@/types/recurrence';
import { fromDateKey, tomorrowKey, weekdayNames, type DateKey } from '@/utils/date';
import { mondayIndex } from '@/utils/recurrence';
import { ChipGroup } from './Chips';
import { DateField } from './DateTimeFields';

type Preset = 'none' | RecurrenceFrequency | 'custom';
type Ends = 'never' | 'until' | 'count';

interface Props {
  value: RecurrenceRule | null;
  onChange: (rule: RecurrenceRule | null) => void;
  /** First occurrence date (defines the default weekday). */
  startDate: DateKey;
}

function presetOf(rule: RecurrenceRule | null): Preset {
  if (!rule) return 'none';
  const custom = rule.interval > 1 || (rule.byWeekday?.length ?? 0) > 1 || !!rule.until || !!rule.count;
  return custom ? 'custom' : rule.freq;
}

/** "No se repite / Diario / Semanal / Mensual / Anual / Personalizado" (section 11). */
export function RecurrenceEditor({ value, onChange, startDate }: Props) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { spacing } = useTheme();
  const [preset, setPreset] = useState<Preset>(presetOf(value));
  const [intervalText, setIntervalText] = useState(String(value?.interval ?? 1));
  const [countText, setCountText] = useState(String(value?.count ?? 10));
  const ends: Ends = value?.until ? 'until' : value?.count ? 'count' : 'never';
  const startWeekday = mondayIndex(fromDateKey(startDate));
  const days = weekdayNames(locale);

  const choosePreset = (p: Preset) => {
    setPreset(p);
    if (p === 'none') onChange(null);
    else if (p === 'custom')
      onChange({ freq: value?.freq ?? 'weekly', interval: value?.interval ?? 1, byWeekday: value?.byWeekday ?? [startWeekday] });
    else onChange({ freq: p, interval: 1 });
  };

  const patch = (next: Partial<RecurrenceRule>) => value && onChange({ ...value, ...next });

  return (
    <View style={{ gap: spacing.md }}>
      <ChipGroup<Preset>
        accessibilityLabel={t('recurrence.label')}
        selected={preset}
        onToggle={choosePreset}
        options={(['none', 'daily', 'weekly', 'monthly', 'yearly', 'custom'] as Preset[]).map((p) => ({
          value: p,
          label: t(`recurrence.presets.${p}`),
        }))}
      />
      {preset === 'custom' && value ? (
        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, flexWrap: 'wrap' }}>
            <View style={{ width: 90 }}>
              <TextField
                compact
                label={t('recurrence.every')}
                value={intervalText}
                inputMode="numeric"
                onChangeText={(v) => {
                  setIntervalText(v);
                  const n = parseInt(v, 10);
                  if (n >= 1 && n <= 99) patch({ interval: n });
                }}
              />
            </View>
            <ChipGroup<RecurrenceFrequency>
              accessibilityLabel={t('recurrence.unit')}
              selected={value.freq}
              onToggle={(freq) => patch({ freq, byWeekday: freq === 'weekly' ? (value.byWeekday ?? [startWeekday]) : undefined })}
              options={(['daily', 'weekly', 'monthly', 'yearly'] as RecurrenceFrequency[]).map((f) => ({
                value: f,
                label: t(`recurrence.units.${f}`, { count: value.interval }),
              }))}
            />
          </View>
          {value.freq === 'weekly' ? (
            <View style={{ gap: spacing.xs }}>
              <AppText variant="smallStrong">{t('recurrence.onDays')}</AppText>
              <ChipGroup<number>
                multi
                compact
                accessibilityLabel={t('recurrence.onDays')}
                selected={value.byWeekday ?? [startWeekday]}
                onToggle={(d) => {
                  const cur = value.byWeekday ?? [startWeekday];
                  const next = cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d];
                  patch({ byWeekday: next.length ? next.sort((a, b) => a - b) : [startWeekday] });
                }}
                options={days.map((label, i) => ({ value: i, label }))}
              />
            </View>
          ) : null}
          <View style={{ gap: spacing.xs }}>
            <AppText variant="smallStrong">{t('recurrence.ends')}</AppText>
            <ChipGroup<Ends>
              accessibilityLabel={t('recurrence.ends')}
              selected={ends}
              onToggle={(e) =>
                patch(
                  e === 'never'
                    ? { until: null, count: null }
                    : e === 'until'
                      ? { until: value.until ?? tomorrowKey(fromDateKey(startDate)), count: null }
                      : { count: parseInt(countText, 10) || 10, until: null },
                )
              }
              options={(['never', 'until', 'count'] as Ends[]).map((e) => ({ value: e, label: t(`recurrence.endsOptions.${e}`) }))}
            />
            {ends === 'until' && value.until ? (
              <DateField label={t('recurrence.untilDate')} value={value.until} onChange={(until) => patch({ until })} />
            ) : null}
            {ends === 'count' ? (
              <View style={{ width: 140 }}>
                <TextField
                  compact
                  label={t('recurrence.times')}
                  value={countText}
                  inputMode="numeric"
                  onChangeText={(v) => {
                    setCountText(v);
                    const n = parseInt(v, 10);
                    if (n >= 1 && n <= 999) patch({ count: n });
                  }}
                />
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}
