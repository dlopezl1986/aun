import { useEffect, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { interaction } from '@/components/ui/interaction';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useEnabledModules } from '@/state/userSettingsStore';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';

const FAB = 60;
const ITEM = 48;

/**
 * Big floating «+» on Inicio. Tapping it unfolds the quick actions upwards
 * from the button itself (a speed dial: label + coloured icon), and the «+»
 * turns into a «×». Each enabled module contributes its own shortcuts and
 * form via AppModule.quickActions.
 */
export function QuickActionsFab() {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const { isCompact } = useBreakpoint();
  const modules = useEnabledModules();
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [progress] = useState(() => new Animated.Value(0));
  const actions = modules
    .slice()
    .sort((a, b) => a.nav.order - b.nav.order)
    .flatMap((m) => (m.quickActions ?? []).map((action) => ({ action, accent: m.accent })));

  useEffect(() => {
    Animated.spring(progress, { toValue: expanded ? 1 : 0, useNativeDriver: true, friction: 7, tension: 80 }).start();
  }, [expanded, progress]);

  if (!actions.length) return null;

  const choose = (id: string) => {
    setExpanded(false);
    setOpen(id);
  };

  const inset = isCompact ? spacing.lg : spacing.xxl;
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] });

  return (
    <>
      {/* Dim the page while the actions are unfolded; tapping outside folds them. */}
      {expanded ? (
        <Pressable
          onPress={() => setExpanded(false)}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9 }}
        >
          <Animated.View style={{ flex: 1, backgroundColor: withAlpha('#0F172A', 0.28), opacity: progress }} />
        </Pressable>
      ) : null}

      <View
        pointerEvents="box-none"
        style={{ position: 'absolute', right: inset, bottom: inset, alignItems: 'flex-end', gap: spacing.md, zIndex: 10 }}
      >
        {/* The list grows upwards out of the «+»: the nearest action comes out first. */}
        <View
          pointerEvents={expanded ? 'box-none' : 'none'}
          style={{ alignItems: 'flex-end', gap: spacing.sm, paddingRight: (FAB - ITEM) / 2 }}
        >
          {actions.map(({ action, accent }, i) => {
            const fromFab = actions.length - i; // distance (in items) from the button
            return (
              <Animated.View
                key={action.id}
                style={{
                  opacity: progress,
                  transform: [
                    { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [fromFab * (ITEM + spacing.sm), 0] }) },
                    { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
                  ],
                }}
              >
                <Pressable
                  onPress={() => choose(action.id)}
                  accessibilityRole="button"
                  accessibilityLabel={t(action.labelKey)}
                  style={(s) => {
                    const { hovered, pressed } = interaction(s);
                    return {
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.md,
                      opacity: pressed ? 0.8 : 1,
                      transform: [{ scale: hovered ? 1.03 : 1 }],
                    };
                  }}
                >
                  <View
                    style={{
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.xs + 2,
                      borderRadius: radius.pill,
                      backgroundColor: colors.surface,
                      boxShadow: '0px 4px 14px rgba(15, 23, 42, 0.16)',
                    }}
                  >
                    <AppText variant="smallStrong" numberOfLines={1}>
                      {t(action.labelKey)}
                    </AppText>
                  </View>
                  <View
                    style={{
                      width: ITEM,
                      height: ITEM,
                      borderRadius: ITEM / 2,
                      backgroundColor: accent,
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: `0px 6px 14px ${withAlpha(accent, 0.38)}`,
                    }}
                  >
                    <Icon name={action.icon} size={20} color="#FFFFFF" />
                  </View>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>

        <Pressable
          onPress={() => setExpanded((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={expanded ? t('common.close') : t('dashboard.quick.title')}
          aria-expanded={expanded}
          style={(s) => {
            const { hovered, pressed } = interaction(s);
            return {
              width: FAB,
              height: FAB,
              borderRadius: FAB / 2,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.primary,
              boxShadow: `0px 10px 24px ${withAlpha(colors.primary, 0.4)}`,
              transform: [{ scale: pressed ? 0.94 : hovered ? 1.05 : 1 }],
            };
          }}
        >
          <Animated.View style={{ transform: [{ rotate }] }}>
            <Icon name="plus" size={30} color={colors.onPrimary} />
          </Animated.View>
        </Pressable>
      </View>

      {actions.map(({ action: { id, Sheet: ActionSheet } }) => (
        <ActionSheet key={id} visible={open === id} onClose={() => setOpen(null)} />
      ))}
    </>
  );
}
