import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';

import { useTheme } from '@/theme';
import { readableOn } from '@/utils/color';

export type IconName = ComponentProps<typeof Feather>['name'];

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  /** Icons are decorative by default; pass a label to expose them to screen readers. */
  accessibilityLabel?: string;
}

export function Icon({ name, size = 20, color, accessibilityLabel }: IconProps) {
  const theme = useTheme();
  return (
    <Feather
      name={name}
      size={size}
      color={color ? (theme.mode === 'dark' ? readableOn(color, theme.colors.surface, 3) : color) : theme.colors.text}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
    />
  );
}
