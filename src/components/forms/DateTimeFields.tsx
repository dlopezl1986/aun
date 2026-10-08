import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { TextField } from '@/components/ui/TextField';
import { DatePickerPopup } from './DatePickerPopup';
import { useTheme } from '@/theme';
import { formatDateInput, parseDateInput, parseTime, todayKey, tomorrowKey, type DateKey } from '@/utils/date';

/**
 * Text-based date/time inputs with quick chips. They work identically on
 * iOS, Android and Web (native pickers are not available on web).
 */
interface DateFieldProps {
  label: string;
  value: DateKey;
  onChange: (value: DateKey) => void;
  onValidityChange?: (valid: boolean) => void;
}

export function DateField({ label, value, onChange, onValidityChange }: DateFieldProps) {
  const { t } = useTranslation();
  const { spacing, radius, colors } = useTheme();
  const [text, setText] = useState(formatDateInput(value));
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  // Re-sync when the value changes from outside (derived state, no effect).
  const [synced, setSynced] = useState(value);
  if (synced !== value) {
    setSynced(value);
    setText(formatDateInput(value));
  }

  const commit = (raw: string) => {
    setText(raw);
    const parsed = parseDateInput(raw);
    setError(parsed ? null : t('forms.invalidDate'));
    onValidityChange?.(!!parsed);
    if (parsed && parsed !== value) {
      setSynced(parsed);
      onChange(parsed);
    }
  };

  const quick = [
    { key: todayKey(), label: t('common.today') },
    { key: tomorrowKey(), label: t('common.tomorrow') },
  ];

  return (
    <View style={{ gap: spacing.sm }}>
      <TextField
        label={label}
        value={text}
        onChangeText={commit}
        placeholder={t('forms.datePlaceholder')}
        error={error}
        leftIcon="calendar"
        onLeftIconPress={() => setPicking(true)}
        leftIconLabel={t('forms.picker.open', { label })}
        inputMode="numeric"
      />
      <DatePickerPopup
        visible={picking}
        title={label}
        value={parseDateInput(text) ?? value}
        onClose={() => setPicking(false)}
        onSelect={(key) => {
          setPicking(false);
          commit(formatDateInput(key));
        }}
      />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {quick.map((q) => (
          <Pressable
            key={q.label}
            onPress={() => commit(formatDateInput(q.key))}
            accessibilityRole="button"
            accessibilityLabel={q.label}
            style={{
              paddingHorizontal: spacing.md,
              minHeight: 32,
              justifyContent: 'center',
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: value === q.key ? colors.primary : colors.border,
              backgroundColor: value === q.key ? colors.primarySoft : 'transparent',
            }}
          >
            <AppText variant="caption" tone={value === q.key ? 'primary' : 'textMuted'}>
              {q.label}
            </AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

interface TimeFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onValidityChange?: (valid: boolean) => void;
}

export function TimeField({ label, value, onChange, onValidityChange }: TimeFieldProps) {
  const { t } = useTranslation();
  const [text, setText] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [synced, setSynced] = useState(value);
  if (synced !== value) {
    setSynced(value);
    setText(value);
  }

  return (
    <TextField
      label={label}
      value={text}
      placeholder="09:30"
      leftIcon="clock"
      inputMode="numeric"
      error={error}
      onChangeText={(raw) => {
        setText(raw);
        const parsed = parseTime(raw);
        setError(parsed ? null : t('forms.invalidTime'));
        onValidityChange?.(!!parsed);
        if (parsed) {
          setSynced(parsed);
          onChange(parsed);
        }
      }}
    />
  );
}
