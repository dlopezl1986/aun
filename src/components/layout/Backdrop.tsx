import { Platform, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

/**
 * Soft gradient glow behind a page (palettes with a `backdrop`, e.g. «Aire»).
 * Purely decorative: never receives touches and is hidden from screen readers.
 */
export function Backdrop() {
  const { backdrop } = useTheme();
  if (!backdrop) return null;
  // react-native-web forwards the CSS property; native uses the New Architecture's.
  const style = Platform.OS === 'web' ? ({ backgroundImage: backdrop } as object) : { experimental_backgroundImage: backdrop };
  return <View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, style]} />;
}
