import { View } from 'react-native';

import { useTheme } from '@/theme';

export function Divider({ inset = 0, vertical = 0 }: { inset?: number; vertical?: number }) {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.border, marginLeft: inset, marginVertical: vertical }} />;
}
