import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDialog } from '@/components/feedback/DialogProvider';
import { useToast } from '@/components/feedback/ToastProvider';
import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { LoadingState } from '@/components/ui/States';
import { deleteAccountData } from '@/services/account/deleteAccount';
import { wipeUserContent } from '@/services/account/wipe';
import { AuthError } from '@/services/auth/types';
import { useAuthStore } from '@/state/authStore';
import { useUserSettings } from '@/state/userSettingsStore';
import { Divider } from '@/components/ui/Divider';
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
  const [running, setRunning] = useState<null | 'wipe' | 'delete'>(null);
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
    setRunning('wipe');
    try {
      const r = await wipeUserContent(services, asyncKeyValueStore);
      await client.invalidateQueries({ queryKey: ['u', services.userId] });
      toast.show(t('settings.danger.done', { count: r.rows }), 'success');
      if (r.filesKept) toast.show(t('settings.danger.filesKept', { count: r.filesKept }), 'error');
    } catch {
      toast.show(t('common.errorDescription'), 'error');
    } finally {
      setRunning(null);
    }
  };

  // App Store requirement: the account can be deleted from inside the app.
  const deleteAccount = async () => {
    const deleteWord = t('settings.danger.deleteWord');
    const ok = await dialog.confirm({
      title: t('settings.danger.deleteTitle'),
      message: t('settings.danger.deleteMessage'),
      confirmLabel: t('settings.danger.continue'),
      destructive: true,
    });
    if (!ok) return;
    const typed = await dialog.prompt({
      title: t('settings.danger.typeTitle'),
      message: t('settings.danger.typeMessage', { word: deleteWord }),
      label: t('settings.danger.typeLabel', { word: deleteWord }),
      placeholder: deleteWord,
      confirmLabel: t('settings.danger.continue'),
      destructive: true,
    });
    if (typed === null || typed === undefined) return;
    if (typed.trim().toUpperCase() !== deleteWord.toUpperCase()) {
      toast.show(t('settings.danger.mismatch', { word: deleteWord }), 'error');
      return;
    }
    const password = await dialog.prompt({
      title: t('settings.danger.passwordTitle'),
      message: t('settings.danger.passwordMessage'),
      label: t('settings.danger.passwordLabel'),
      confirmLabel: t('settings.danger.deleteAccount'),
      destructive: true,
      secure: true,
    });
    if (!password) return;
    setRunning('delete');
    try {
      await useAuthStore.getState().deleteAccount(password, () => deleteAccountData(services, asyncKeyValueStore));
      client.clear();
      useUserSettings.getState().clear();
      toast.show(t('settings.danger.deleted'), 'success');
    } catch (e) {
      const code = e instanceof AuthError ? e.code : null;
      toast.show(
        t(
          code === 'invalid-credentials'
            ? 'settings.danger.wrongPassword'
            : code === 'requires-backend'
              ? 'settings.danger.deleteUnavailable'
              : 'settings.danger.deleteFailed',
        ),
        'error',
      );
      setRunning(null);
    }
  };

  return (
    <Card padded={false} style={{ padding: spacing.xs }}>
      {running ? (
        <LoadingState label={t(running === 'delete' ? 'settings.danger.deleting' : 'settings.danger.running')} />
      ) : (
        <>
          <ListRow
            icon="trash-2"
            title={t('settings.danger.wipe')}
            subtitle={t('settings.danger.wipeHint')}
            destructive
            onPress={() => void wipe()}
          />
          <Divider />
          <ListRow
            icon="user-x"
            title={t('settings.danger.deleteAccount')}
            subtitle={t('settings.danger.deleteAccountHint')}
            destructive
            onPress={() => void deleteAccount()}
          />
        </>
      )}
    </Card>
  );
}
