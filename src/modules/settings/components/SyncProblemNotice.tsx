import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { useSignOut } from '@/hooks/useSignOut';
import { useServices } from '@/services/ServicesProvider';
import { useSyncNow, useSyncStatus } from '@/services/sync/useAutoSync';
import { useCurrentUser } from '@/state/authStore';
import { useTheme } from '@/theme';

/** Content inside the card (reads the card palette). */
function Body() {
  const { t } = useTranslation();
  const { spacing, colors } = useTheme();
  const user = useCurrentUser();
  const syncNow = useSyncNow();
  const signOut = useSignOut();
  const { running, error } = useSyncStatus();
  return (
    <View style={{ gap: spacing.md }} accessibilityLiveRegion="polite">
      <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
        <Icon name="cloud-off" size={20} color={colors.danger} />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <AppText variant="bodyStrong">{t('sync.problem.title')}</AppText>
          <AppText variant="small" tone="textMuted">
            {t(`sharing.sync.errors.${error}`, { defaultValue: t('sharing.sync.errors.unknown') })}
          </AppText>
          <AppText variant="caption" tone="textSubtle">
            {t('sync.problem.account', { email: user.email })}
          </AppText>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Button label={t('sharing.sync.now')} icon="refresh-cw" size="sm" loading={running} onPress={() => void syncNow()} />
        {error === 'unauthorized' ? (
          <Button label={t('auth.signOut')} icon="log-out" size="sm" variant="secondary" onPress={() => void signOut()} />
        ) : null}
      </View>
    </View>
  );
}

/**
 * Inicio: the last sync failed, so this device may be showing old data and
 * its changes are not reaching the family. Says so (and with which account)
 * instead of failing silently. Hidden in local-only mode.
 */
export function SyncProblemNotice() {
  const services = useServices();
  const error = useSyncStatus((s) => s.error);
  if (!services.sync || !error) return null;
  return (
    <Card>
      <Body />
    </Card>
  );
}
