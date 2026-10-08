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
                flexGrow: 1,
                flexBasis: 150,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                minHeight: 48,
                paddingHorizontal: spacing.md,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: hovered ? withAlpha(accent, 0.5) : colors.border,
                backgroundColor: pressed ? withAlpha(accent, 0.1) : hovered ? withAlpha(accent, 0.05) : colors.surface,
              };
            }}
          >
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: radius.sm + 2,
                backgroundColor: withAlpha(accent, 0.13),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={action.icon} size={16} color={accent} />
            </View>
            <AppText variant="smallStrong" numberOfLines={1} style={{ flex: 1 }}>
              {t(action.labelKey)}
            </AppText>
            <Icon name="plus" size={16} color={colors.textSubtle} />
          </Pressable>
        ))}
      </View>
      {actions.map(({ action }) => renderSheet(action))}
    </Card>
  );
}
