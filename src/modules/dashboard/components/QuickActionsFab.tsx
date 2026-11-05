import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { interaction } from '@/components/ui/interaction';
import { Sheet } from '@/components/ui/Sheet';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useEnabledModules } from '@/state/userSettingsStore';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';

const TILE = 100;
const FAB = 60;

/**
 * Big floating «+» on Inicio: opens the quick actions (each enabled module
 * contributes its own shortcuts and form via AppModule.quickActions), so they
 * no longer take a row of the page.
 */
export function QuickActionsFab() {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const { isCompact } = useBreakpoint();
  const modules = useEnabledModules();
  const [menuOpen, setMenuOpen] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const actions = modules
    .slice()
    .sort((a, b) => a.nav.order - b.nav.order)
    .flatMap((m) => (m.quickActions ?? []).map((action) => ({ action, accent: m.accent })));

  if (!actions.length) return null;

  const choose = (id: string) => {
    setMenuOpen(false);
    setOpen(id);
  };

  const inset = isCompact ? spacing.lg : spacing.xxl;

  return (
    <>
      <Pressable
        onPress={() => setMenuOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('dashboard.quick.title')}
        style={(s) => {
          const { hovered, pressed } = interaction(s);
          return {
            position: 'absolute',
            right: inset,
            bottom: inset,
            width: FAB,
            height: FAB,
            borderRadius: FAB / 2,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary,
            boxShadow: `0px 10px 24px ${withAlpha(colors.primary, 0.4)}`,
            transform: [{ scale: pressed ? 0.94 : hovered ? 1.05 : 1 }],
            zIndex: 10,
          };
        }}
      >
        <Icon name="plus" size={30} color={colors.onPrimary} />
      </Pressable>

      <Sheet visible={menuOpen} onClose={() => setMenuOpen(false)} title={t('dashboard.quick.title')}>
        {/* Square tiles (icon in a coloured square + label), like app shortcuts. */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' }}>
          {actions.map(({ action, accent }) => (
            <Pressable
              key={action.id}
              onPress={() => choose(action.id)}
              accessibilityRole="button"
              accessibilityLabel={t(action.labelKey)}
              style={(s) => {
                const { hovered, pressed } = interaction(s);
                return {
                  width: TILE,
                  alignItems: 'center',
                  gap: spacing.sm,
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.xs,
                  borderRadius: radius.lg,
                  backgroundColor: pressed ? withAlpha(accent, 0.14) : hovered ? withAlpha(accent, 0.08) : colors.surfaceMuted,
                };
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: radius.md + 2,
                  backgroundColor: accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0px 6px 14px ${withAlpha(accent, 0.32)}`,
                }}
              >
                <Icon name={action.icon} size={22} color="#FFFFFF" />
              </View>
              <AppText variant="caption" numberOfLines={2} style={{ textAlign: 'center' }}>
                {t(action.labelKey)}
              </AppText>
            </Pressable>
          ))}
        </View>
      </Sheet>

      {actions.map(({ action: { id, Sheet: ActionSheet } }) => (
        <ActionSheet key={id} visible={open === id} onClose={() => setOpen(null)} />
      ))}
    </>
  );
}
