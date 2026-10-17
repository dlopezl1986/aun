import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useToast } from '@/components/feedback/ToastProvider';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { authGateway } from '@/services/auth';
import { useAuthStore, useCurrentUser } from '@/state/authStore';
import { useTheme } from '@/theme';

/** Content inside the card (reads the card palette). */
function Body() {
  const { t, i18n } = useTranslation();
  const { spacing, colors } = useTheme();
  const toast = useToast();
  const user = useCurrentUser();
  const [busy, setBusy] = useState<null | 'send' | 'check'>(null);

  const resend = async () => {
    setBusy('send');
    try {
      await authGateway.sendEmailVerification(i18n.language);
      toast.show(t('auth.verify.sent', { email: user.email }));
    } catch {
      toast.show(t('auth.verify.sendFailed'), 'error');
    } finally {
      setBusy(null);
    }
  };
  const check = async () => {
    setBusy('check');
    try {
      const fresh = await useAuthStore.getState().refreshUser();
      toast.show(t(fresh?.emailVerified ? 'auth.verify.done' : 'auth.verify.notYet'), fresh?.emailVerified ? 'success' : 'info');
    } catch {
      toast.show(t('common.errorDescription'), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
        <Icon name="mail" size={20} color={colors.warning} />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <AppText variant="bodyStrong">{t('auth.verify.title')}</AppText>
          <AppText variant="small" tone="textMuted">
            {t('auth.verify.description', { email: user.email })}
          </AppText>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Button label={t('auth.verify.check')} icon="check" size="sm" loading={busy === 'check'} onPress={() => void check()} />
        <Button
          label={t('auth.verify.resend')}
          icon="send"
          size="sm"
          variant="secondary"
          loading={busy === 'send'}
          onPress={() => void resend()}
        />
      </View>
    </View>
  );
}

/** Reminder until the account's e-mail is confirmed (only where that applies). */
export function VerifyEmailNotice() {
  const verified = useAuthStore((s) => s.session?.user.emailVerified);
  if (verified !== false) return null;
  return (
    <Card>
      <Body />
    </Card>
  );
}
