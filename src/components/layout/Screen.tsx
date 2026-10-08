import { useState, type PropsWithChildren } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBreakpoint } from '@/hooks/useBreakpoint';
import { CanvasScope, useTheme } from '@/theme';

interface ScreenProps {
  scroll?: boolean;
  maxWidth?: number;
  /** Enables pull-to-refresh (mobile); the promise drives the spinner. */
  onRefresh?: () => Promise<unknown>;
}

/** Standard page container: safe areas, responsive gutters, max content width. */
export function Screen({ children, scroll = true, maxWidth, onRefresh }: PropsWithChildren<ScreenProps>) {
  const { colors, spacing, layout } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };
  const insets = useSafeAreaInsets();
  const { isCompact, breakpoint } = useBreakpoint();
  const gutter = isCompact ? spacing.lg : breakpoint === 'medium' ? spacing.xxl : spacing.xxxl;
  const inner = (
    <View
      style={{
        width: '100%',
        maxWidth: maxWidth ?? layout.contentMaxWidth,
        alignSelf: 'center',
        gap: spacing.xl,
        flex: scroll ? undefined : 1,
      }}
    >
      <CanvasScope>{children}</CanvasScope>
    </View>
  );
  const padding = {
    paddingTop: (isCompact ? insets.top : 0) + (isCompact ? spacing.lg : spacing.xxl),
    paddingHorizontal: gutter,
    paddingBottom: isCompact ? spacing.xxl : spacing.huge,
  };

  if (!scroll) return <View style={[{ flex: 1, backgroundColor: colors.background }, padding]}>{inner}</View>;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={padding}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} colors={[colors.primary]} />
        ) : undefined
      }
    >
      {inner}
    </ScrollView>
  );
}
