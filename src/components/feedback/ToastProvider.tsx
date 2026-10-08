import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { Animated, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useTheme } from '@/theme';

type ToastTone = 'success' | 'error' | 'info';

interface ToastApi {
  show: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const icons: Record<ToastTone, IconName> = { success: 'check-circle', error: 'alert-circle', info: 'info' };

export function ToastProvider({ children }: PropsWithChildren) {
  const [toast, setToast] = useState<{ id: number; message: string; tone: ToastTone } | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { colors, radius, spacing, layout } = useTheme();
  const insets = useSafeAreaInsets();
  const { isCompact } = useBreakpoint();

  const nextId = useRef(0);
  const show = useCallback((message: string, tone: ToastTone = 'success') => {
    nextId.current += 1;
    setToast({ id: nextId.current, message, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const { id } = toast;
    // A new toast interrupts any fade-out still running for the previous one.
    opacity.stopAnimation();
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(({ finished }) => {
        // Only clear the toast this timer belongs to (never a newer one).
        if (finished) setToast((current) => (current?.id === id ? null : current));
      });
    }, 2600);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [toast, opacity]);

  const api = useMemo(() => ({ show }), [show]);
  const color = toast ? { success: colors.success, error: colors.danger, info: colors.info }[toast.tone] : colors.text;

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: isCompact ? insets.bottom + layout.bottomBarHeight + spacing.md : spacing.xxl,
            alignItems: isCompact ? 'center' : 'flex-end',
            paddingHorizontal: spacing.lg,
          }}
        >
          <Animated.View
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            style={{
              opacity,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              maxWidth: 420,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.lg,
              borderRadius: radius.lg,
              backgroundColor: colors.sidebar,
              boxShadow: '0px 8px 24px rgba(0,0,0,0.25)',
            }}
          >
            <Icon name={icons[toast.tone]} size={18} color={color} />
            <AppText variant="smallStrong" color="#FFFFFF">
              {toast.message}
            </AppText>
          </Animated.View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
