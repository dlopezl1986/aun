import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { makeStyles, SurfaceScope, useTheme } from '@/theme';
import { lighten, withAlpha } from '@/utils/color';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { interaction } from './interaction';

interface CardProps {
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}

export function Card({ children, style, padded = true }: PropsWithChildren<CardProps>) {
  return (
    <SurfaceScope>
      <CardBody style={style} padded={padded}>
        {children}
      </CardBody>
    </SurfaceScope>
  );
}

/** Rendered inside SurfaceScope so the card uses the normal (cream) palette even on the dark canvas. */
function CardBody({ children, style, padded }: PropsWithChildren<CardProps>) {
  const styles = useStyles();
  return <View style={[styles.card, padded && styles.padded, style]}>{children}</View>;
}

interface CardHeaderProps {
  title: string;
  icon?: IconName;
  accent?: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  right?: ReactNode;
}

export function CardHeader({ title, icon, accent, subtitle, actionLabel, onAction, right }: CardHeaderProps) {
  const styles = useStyles();
  const theme = useTheme();
  const color = accent ?? theme.colors.primary;
  return (
    <View style={styles.header}>
      {icon ? (
        <View style={[styles.iconTile, { backgroundColor: withAlpha(color, theme.mode === 'dark' ? 0.2 : 0.14) }]}>
          <Icon name={icon} size={18} color={theme.mode === 'dark' ? lighten(color, 0.3) : color} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <AppText variant="heading" accessibilityRole="header" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="small" tone="textMuted" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="link"
          hitSlop={10}
          style={(s) => ({ opacity: interaction(s).pressed ? 0.6 : 1, flexDirection: 'row', alignItems: 'center', gap: 2 })}
        >
          <AppText variant="smallStrong" tone="primary">
            {actionLabel}
          </AppText>
          <Icon name="chevron-right" size={14} color={theme.colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  card: {
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.lg,
    borderWidth: 1,
    borderColor: t.colors.border,
    boxShadow: t.shadow.card,
  },
  padded: { padding: t.spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, marginBottom: t.spacing.lg },
  iconTile: { width: 36, height: 36, borderRadius: t.radius.md, alignItems: 'center', justifyContent: 'center' },
}));
