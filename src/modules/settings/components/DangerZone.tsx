import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDialog } from '@/components/feedback/DialogProvider';
import { useToast } from '@/components/feedback/ToastProvider';
import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { LoadingState } from '@/components/ui/States';
import { wipeUserContent } from '@/services/account/wipe';
import { useServices } from '@/services/ServicesProvider';
import { asyncKeyValueStore } from '@/storage/keyValueStore';
import { useTheme } from '@/theme';

/** "Zona de peligro": delete all the account's content (double confirmation). */
export function DangerZone() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const dialog = useDialog();
  const toast = useToast();
  const services = useServices();
  const client = useQueryClient();
  const [running, setRunning] = useState(false);
  const word = t('settings.danger.confirmWord');

  const wipe = async () => {
    const ok = await dialog.confirm({
      title: t('settings.danger.wipeTitle'),
      message: t('settings.danger.wipeMessage'),
      confirmLabel: t('settings.danger.continue'),
      destructive: true,
    });
    if (!ok) return;
    const typed = await dialog.prompt({
      title: t('settings.danger.typeTitle'),
      message: t('settings.danger.typeMessage', { word }),
      label: t('settings.danger.typeLabel', { word }),
      placeholder: word,
      confirmLabel: t('settings.danger.wipe'),
      destructive: true,
    });
    if (typed === null || typed === undefined) return;
    if (typed.trim().toUpperCase() !== word.toUpperCase()) {
      toast.show(t('settings.danger.mismatch', { word }), 'error');
      return;
    }
    setRunning(true);
    try {
      const r = await wipeUserContent(services, asyncKeyValueStore);
      await client.invalidateQueries({ queryKey: ['u', services.userId] });
      toast.show(t('settings.danger.done', { count: r.rows }), 'success');
      if (r.filesKept) toast.show(t('settings.danger.filesKept', { count: r.filesKept }), 'error');
    } catch {
      toast.show(t('common.errorDescription'), 'error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card padded={false} style={{ padding: spacing.xs }}>
      {running ? (
        <LoadingState label={t('settings.danger.running')} />
      ) : (
        <ListRow
          icon="trash-2"
          title={t('settings.danger.wipe')}
          subtitle={t('settings.danger.wipeHint')}
          destructive
          onPress={() => void wipe()}
        />
      )}
    </Card>
  );
}
