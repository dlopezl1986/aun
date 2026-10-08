import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useLocale } from '@/hooks/useLocale';
import { useSyncNow, useSyncStatus } from '@/services/sync/useAutoSync';
import { useTheme } from '@/theme';
import { formatTime } from '@/utils/date';

/**
 * Shared data arrives through sync: show when it last worked, the error if it
 * did not, and a button that downloads everything again. Right after joining
 * a family (`justJoined`) it runs that full download at once.
 */
export function SharingSyncStatus({ justJoined = false, ownerName }: { justJoined?: boolean; ownerName?: string }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { spacing, colors, radius } = useTheme();
  const syncNow = useSyncNow();
  const { running, last, error } = useSyncStatus();
  const [joining, setJoining] = useState(justJoined);
  const started = useRef(false);

  useEffect(() => {
    if (!justJoined || started.current) return;
    started.current = true;
    void syncNow({ full: true }).finally(() => setJoining(false));
  }, [justJoined, syncNow]);

  const tone = error ? colors.danger : colors.success;
  const message = running
    ? joining
      ? t('sharing.sync.joining', { name: ownerName || t('sharing.someone') })
      : t('sharing.sync.running')
    : error
      ? t(`sharing.sync.errors.${error}`, { defaultValue: t('sharing.sync.errors.unknown') })
      : last
        ? t('sharing.sync.ok', { time: formatTime(new Date(last.at), locale) })
        : t('sharing.sync.pending');

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: spacing.sm,
        padding: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: colors.surfaceMuted,
      }}
      accessibilityLiveRegion="polite"
    >
      <Icon name={running ? 'refresh-cw' : error ? 'alert-triangle' : 'check-circle'} size={16} color={running ? colors.primary : tone} />
      <AppText variant="small" tone={error ? 'danger' : 'textMuted'} style={{ flex: 1, minWidth: 160 }}>
        {message}
      </AppText>
      <Button
        label={t('sharing.sync.now')}
        icon="refresh-cw"
        size="sm"
        variant="secondary"
        loading={running}
        onPress={() => void syncNow({ full: true })}
      />
    </View>
  );
}
