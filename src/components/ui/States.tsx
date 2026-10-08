import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { makeStyles, useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';
import { AppText } from './AppText';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';

interface EmptyStateProps {
  icon: IconName;
  title: string;
  description?: string;
  accent?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondary?: ReactNode;
  compact?: boolean;
}

/** Never leave a screen blank: every list uses this when it has no data. */
export function EmptyState({ icon, title, description, accent, actionLabel, onAction, secondary, compact }: EmptyStateProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const color = accent ?? colors.primary;
  return (
    <View style={[styles.root, compact && styles.compact]} accessibilityRole="summary">
      <View style={[styles.iconCircle, compact && styles.iconCircleCompact, { backgroundColor: withAlpha(color, 0.12) }]}>
        <Icon name={icon} size={compact ? 18 : 24} color={color} />
      </View>
      <AppText variant={compact ? 'subheading' : 'heading'} align="center">
        {title}
      </AppText>
      {description ? (
        <AppText variant="small" tone="textMuted" align="center" style={styles.description}>
          {description}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} icon="plus" size={compact ? 'sm' : 'md'} style={styles.action} />
      ) : null}
      {secondary}
    </View>
  );
}

export function LoadingState({ label }: { label?: string }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useStyles();
  return (
    <View style={styles.root} accessibilityRole="progressbar" accessibilityLabel={label ?? t('common.loading')}>
      <ActivityIndicator color={colors.primary} />
      <AppText variant="small" tone="textMuted">
        {label ?? t('common.loading')}
      </AppText>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.root} accessibilityRole="alert">
      <View style={[styles.iconCircle, { backgroundColor: colors.dangerSoft }]}>
        <Icon name="alert-triangle" size={22} color={colors.danger} />
      </View>
      <AppText variant="heading" align="center">
        {t('common.errorTitle')}
      </AppText>
      <AppText variant="small" tone="textMuted" align="center" style={styles.description}>
        {message ?? t('common.errorDescription')}
      </AppText>
      {onRetry ? <Button label={t('common.retry')} onPress={onRetry} variant="secondary" icon="refresh-cw" /> : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.sm,
    paddingVertical: t.spacing.xxxl,
    paddingHorizontal: t.spacing.xl,
  },
  compact: { paddingVertical: t.spacing.xl },
  iconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: t.spacing.xs },
  iconCircleCompact: { width: 40, height: 40, borderRadius: 20 },
  description: { maxWidth: 380 },
  action: { marginTop: t.spacing.sm, alignSelf: 'center' },
}));
