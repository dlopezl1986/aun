import { ActivityIndicator, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { SurfaceScope, useTheme } from '@/theme';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { interaction } from './interaction';

export type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

const heights: Record<ButtonSize, number> = { sm: 36, md: 44, lg: 52 };

function ButtonBase({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading,
  disabled,
  fullWidth,
  accessibilityHint,
  style,
}: ButtonProps) {
  const { colors, radius, spacing } = useTheme();
  const palette = {
    primary: { bg: colors.primary, hover: colors.primaryPressed, fg: colors.onPrimary, border: colors.primary },
    secondary: { bg: colors.surface, hover: colors.surfaceMuted, fg: colors.text, border: colors.borderStrong },
    soft: { bg: colors.primarySoft, hover: colors.primarySoft, fg: colors.primary, border: colors.primarySoft },
    ghost: { bg: 'transparent', hover: colors.surfaceMuted, fg: colors.text, border: 'transparent' },
    danger: { bg: colors.danger, hover: colors.danger, fg: '#FFFFFF', border: colors.danger },
  }[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      aria-disabled={!!isDisabled}
      aria-busy={!!loading}
      hitSlop={size === 'sm' ? 4 : 0}
      style={(state) => {
        const { pressed, hovered } = interaction(state);
        return [
          {
            minHeight: heights[size],
            paddingHorizontal: size === 'sm' ? spacing.md : spacing.lg,
            borderRadius: radius.md,
            backgroundColor: hovered || pressed ? palette.hover : palette.bg,
            borderWidth: 1,
            borderColor: palette.border,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            alignSelf: fullWidth ? 'stretch' : 'flex-start',
            opacity: isDisabled ? 0.5 : pressed ? 0.88 : 1,
          } satisfies ViewStyle,
          style,
        ];
      }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.fg} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 18} color={palette.fg} /> : null}
          <AppText variant={size === 'sm' ? 'smallStrong' : 'bodyStrong'} color={palette.fg} weight="semibold">
            {label}
          </AppText>
          {iconRight ? <Icon name={iconRight} size={16} color={palette.fg} /> : null}
        </View>
      )}
    </Pressable>
  );
}

/** Filled/outlined buttons have their own background (normal palette); ghost ones adapt to the canvas. */
export function Button(props: ButtonProps) {
  const inner = <ButtonBase {...props} />;
  return (props.variant ?? 'primary') === 'ghost' ? inner : <SurfaceScope>{inner}</SurfaceScope>;
}
