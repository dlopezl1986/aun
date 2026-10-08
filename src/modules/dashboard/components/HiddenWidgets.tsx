import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import type { DashboardWidgetState } from '@/state/userSettingsStore';
import { useModules } from '@/state/userSettingsStore';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';

/** Edit mode: widgets the user has hidden, ready to be added back. */
export function HiddenWidgets({ widgets, onShow }: { widgets: DashboardWidgetState[]; onShow: (id: string) => void }) {
  const { t } = useTranslation();
  const { spacing, radius, colors } = useTheme();
  const modules = useModules();

  return (
    <View style={{ gap: spacing.md }}>
      <AppText variant="overline" tone="textMuted">
        {t('dashboard.edit.hiddenTitle', { count: widgets.length })}
      </AppText>
      {widgets.length === 0 ? (
        <AppText variant="small" tone="textMuted">
          {t('dashboard.edit.allVisible')}
        </AppText>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          {widgets.map(({ definition: w }) => {
            const accent = modules.find((m) => m.id === w.moduleId)?.accent ?? colors.primary;
            return (
              <Card key={w.id} style={{ flexGrow: 1, flexBasis: 260, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: radius.md,
                    backgroundColor: withAlpha(accent, 0.12),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name={w.icon} size={18} color={accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {t(w.titleKey)}
                  </AppText>
                  <AppText variant="small" tone="textMuted" numberOfLines={2}>
                    {t(w.descriptionKey)}
                  </AppText>
                </View>
                <Button label={t('common.add')} size="sm" variant="soft" icon="plus" onPress={() => onShow(w.id)} />
              </Card>
            );
          })}
        </View>
      )}
    </View>
  );
}
