import { Pressable, View } from 'react-native';

import { hitSize, SurfaceScope, useTheme } from '@/theme';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { interaction } from './interaction';

interface IconButtonProps {
  icon: IconName;
  /** Required: icon-only buttons must be labelled for screen readers. */
  label: string;
  onPress?: () => void;
  color?: string;
  size?: number;
  badge?: number;
  variant?: 'ghost' | 'surface';
  disabled?: boolean;
}

function IconButtonBase({ icon, label, onPress, color, size = 20, badge, variant = 'ghost', disabled }: IconButtonProps) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label} (${badge})` : label}
      aria-disabled={!!disabled}
      style={(state) => {
        const { pressed, hovered } = interaction(state);
        return {
          width: hitSize - 4,
          height: hitSize - 4,
          borderRadius: radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed || hovered ? colors.surfacePressed : variant === 'surface' ? colors.surface : 'transparent',
          borderWidth: variant === 'surface' ? 1 : 0,
          borderColor: colors.border,
          opacity: disabled ? 0.4 : 1,
        };
      }}
    >
      <Icon name={icon} size={size} color={color ?? colors.textMuted} />
      {badge ? (
        <View
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            minWidth: 16,
            height: 16,
            paddingHorizontal: 4,
            borderRadius: 8,
            backgroundColor: colors.danger,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText variant="caption" color="#FFFFFF" style={{ fontSize: 10, lineHeight: 12 }}>
            {badge > 99 ? '99+' : badge}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

export function IconButton(props: IconButtonProps) {
  const inner = <IconButtonBase {...props} />;
  return props.variant === 'surface' ? <SurfaceScope>{inner}</SurfaceScope> : inner;
}
