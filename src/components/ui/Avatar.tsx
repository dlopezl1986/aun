import { View } from 'react-native';

import { accentPalette } from '@/theme';
import { colorFromString } from '@/utils/color';
import { AppText } from './AppText';

interface AvatarProps {
  name: string;
  size?: number;
  color?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function Avatar({ name, size = 36, color }: AvatarProps) {
  const bg = color ?? colorFromString(name, accentPalette);
  return (
    <View
      accessibilityLabel={name}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}
    >
      <AppText variant={size >= 44 ? 'heading' : 'caption'} color="#FFFFFF" weight="semibold">
        {initials(name)}
      </AppText>
    </View>
  );
}
