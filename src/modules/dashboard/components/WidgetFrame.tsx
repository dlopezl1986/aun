import type { PropsWithChildren } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { useTheme, SurfaceScope } from '@/theme';
import type { DashboardWidgetDefinition, WidgetSize } from '@/types/module';

const ALL_SIZES: WidgetSize[] = ['md', 'lg', 'full'];

interface Props {
  definition: DashboardWidgetDefinition;
  size: WidgetSize;
  isFirst: boolean;
  isLast: boolean;
  onMove: (direction: -1 | 1) => void;
  onResize: (size: WidgetSize) => void;
  onHide: () => void;
}

/**
 * Edit-mode chrome around a widget: reorder, resize (S/M/L) and hide.
 * The widget itself is shown but not interactive while editing.
 */
function WidgetFrameBase({ definition, size, isFirst, isLast, onMove, onResize, onHide, children }: PropsWithChildren<Props>) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const title = t(definition.titleKey);
  const sizes = definition.sizes ?? ALL_SIZES;

  return (
    <View
      style={{
        borderRadius: radius.lg + 4,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: colors.primary,
        padding: spacing.xs,
        gap: spacing.xs,
        flex: 1,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: spacing.xs,
          paddingHorizontal: spacing.xs,
          paddingVertical: 2,
          borderRadius: radius.md,
          backgroundColor: colors.primarySoft,
        }}
      >
        <Icon name="move" size={14} color={colors.primary} />
        <AppText variant="smallStrong" tone="primary" numberOfLines={1} style={{ flex: 1, minWidth: 80 }}>
          {title}
        </AppText>
        <IconButton
          icon="arrow-left"
          size={16}
          color={colors.primary}
          label={t('dashboard.edit.moveBefore', { name: title })}
          disabled={isFirst}
          onPress={() => onMove(-1)}
        />
        <IconButton
          icon="arrow-right"
          size={16}
          color={colors.primary}
          label={t('dashboard.edit.moveAfter', { name: title })}
          disabled={isLast}
          onPress={() => onMove(1)}
        />
        {sizes.length > 1 ? (
          <View
            style={{ flexDirection: 'row', gap: 2 }}
            accessibilityRole="radiogroup"
            accessibilityLabel={t('dashboard.edit.size', { name: title })}
          >
            {sizes.map((s) => {
              const active = s === size;
              return (
                <Pressable
                  key={s}
                  onPress={() => onResize(s)}
                  accessibilityRole="radio"
                  aria-checked={active}
                  accessibilityLabel={t(`dashboard.sizes.${s}`)}
                  hitSlop={4}
                  style={{
                    minWidth: 30,
                    height: 28,
                    paddingHorizontal: 6,
                    borderRadius: radius.sm,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: active ? colors.primary : colors.surface,
                  }}
                >
                  <AppText variant="caption" color={active ? colors.onPrimary : colors.textMuted}>
                    {t(`dashboard.sizes.short.${s}`)}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        <IconButton icon="eye-off" size={16} color={colors.danger} label={t('dashboard.edit.hide', { name: title })} onPress={onHide} />
      </View>
      <View pointerEvents="none" style={{ opacity: 0.85, flex: 1 }} importantForAccessibility="no-hide-descendants">
        {children}
      </View>
    </View>
  );
}

/** The edit toolbar has its own light background (normal palette). */
export function WidgetFrame(props: PropsWithChildren<Props>) {
  return (
    <SurfaceScope>
      <WidgetFrameBase {...props} />
    </SurfaceScope>
  );
}
