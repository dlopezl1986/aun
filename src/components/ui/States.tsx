import { createContext, useContext, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useBreakpoint } from '@/hooks/useBreakpoint';
import { makeStyles, useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';
import { AppText } from './AppText';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { IconButton } from './IconButton';

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

/**
 * Inside the Inicio widgets an empty list is a single short line ("Nada
 * pendiente para hoy  + Añadir") instead of a big centred block, so empty
 * widgets take little room and the page needs less scrolling.
 */
const InlineEmptyContext = createContext(false);

export function InlineEmptyStates({ children }: { children: ReactNode }) {
  return <InlineEmptyContext.Provider value>{children}</InlineEmptyContext.Provider>;
}

/** Never leave a screen blank: every list uses this when it has no data. */
export function EmptyState({ icon, title, description, accent, actionLabel, onAction, secondary, compact }: EmptyStateProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const inline = useContext(InlineEmptyContext);
  const { isCompact } = useBreakpoint();
  const color = accent ?? colors.primary;
  if (inline) {
    return (
      <View style={styles.inline} accessibilityRole="summary">
        <View style={styles.inlineRow}>
          <View style={[styles.iconCircleInline, { backgroundColor: withAlpha(color, 0.12) }]}>
            <Icon name={icon} size={14} color={color} />
          </View>
          <AppText variant="small" tone="textMuted" style={{ flex: 1 }} numberOfLines={2}>
            {title}
          </AppText>
          {actionLabel && onAction ? (
            // Phones: just the "+" so the line stays one line.
            isCompact ? (
              <IconButton icon="plus" label={actionLabel} variant="surface" color={color} onPress={onAction} />
            ) : (
              <Button label={actionLabel} onPress={onAction} icon="plus" size="sm" variant="secondary" />
            )
          ) : null}
        </View>
        {secondary}
      </View>
    );
  }
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
  inline: { gap: t.spacing.sm, paddingVertical: t.spacing.xs },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  iconCircleInline: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
}));
