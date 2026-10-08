import { Platform, Switch } from 'react-native';

import { useTheme } from '@/theme';

interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}

export function Toggle({ value, onValueChange, label, disabled }: ToggleProps) {
  const { colors } = useTheme();
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityRole="switch"
      aria-checked={value}
      aria-disabled={!!disabled}
      trackColor={{ false: colors.borderStrong, true: colors.primary }}
      thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
      // react-native-web specific prop to colour the active thumb
      {...(Platform.OS === 'web' ? { activeThumbColor: '#FFFFFF' } : {})}
    />
  );
}
