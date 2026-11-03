import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { interaction } from '@/components/ui/interaction';
import { useEnabledModules } from '@/state/userSettingsStore';
import { useTheme } from '@/theme';
import type { QuickAction } from '@/types/module';
import { withAlpha } from '@/utils/color';

const TILE = 100;

/**
 * "Acciones rápidas": capture anything without leaving Inicio. Each enabled
 * module contributes its own shortcuts and form (AppModule.quickActions).
 */
export function QuickActionsWidget() {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const modules = useEnabledModules();
  const [open, setOpen] = useState<string | null>(null);
  const actions = modules
    .slice()
    .sort((a, b) => a.nav.order - b.nav.order)
    .flatMap((m) => (m.quickActions ?? []).map((action) => ({ action, accent: m.accent })));

  if (!actions.length) return null;

  const renderSheet = ({ id, Sheet }: QuickAction) => <Sheet key={id} visible={open === id} onClose={() => setOpen(null)} />;

  // Square tiles (icon in a coloured square + label), like app shortcuts.
  return (
    <Card style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {actions.map(({ action, accent }) => (
          <Pressable
            key={action.id}
            onPress={() => setOpen(action.id)}
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
      {actions.map(({ action }) => renderSheet(action))}
    </Card>
  );
}
