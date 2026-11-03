import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Icon, type IconName } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  accent?: string;
  actions?: ReactNode;
  onBack?: () => void;
}

export function PageHeader({ title, subtitle, icon, accent, actions, onBack }: PageHeaderProps) {
  const { spacing, radius, colors } = useTheme();
  const { isCompact } = useBreakpoint();
  const { t } = useTranslation();
  const color = accent ?? colors.primary;
  return (
    <View style={{ flexDirection: isCompact ? 'column' : 'row', alignItems: isCompact ? 'stretch' : 'center', gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: isCompact ? undefined : 1 }}>
        {onBack ? <IconButton icon="arrow-left" label={t('common.back')} onPress={onBack} /> : null}
        {icon ? (
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: radius.md + 4,
              backgroundColor: color,
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0px 8px 18px ${withAlpha(color, 0.3)}`,
            }}
          >
            <Icon name={icon} size={22} color="#FFFFFF" />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <AppText variant={isCompact ? 'title' : 'display'} accessibilityRole="header" numberOfLines={2}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="body" tone="textMuted" numberOfLines={2}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
      </View>
      {actions ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}>{actions}</View> : null}
    </View>
  );
}
