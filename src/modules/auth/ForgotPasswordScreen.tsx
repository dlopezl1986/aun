import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { InfoNote } from '@/components/ui/InfoNote';
import { TextField } from '@/components/ui/TextField';
import { authGateway, type PasswordResetResult } from '@/services/auth';
import { isValidEmail } from '@/utils/validation';
import { AuthLayout } from './components/AuthLayout';

export function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PasswordResetResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!isValidEmail(email)) {
      setError(t('auth.errors.invalid-email'));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      setResult(await authGateway.requestPasswordReset(email));
    } catch {
      setError(t('auth.errors.unknown'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title={t('auth.forgotTitle')} subtitle={t('auth.forgotSubtitle')}>
      <TextField
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        leftIcon="mail"
        error={error}
        onSubmitEditing={() => void submit()}
      />
      <Button label={t('auth.sendReset')} onPress={() => void submit()} loading={loading} fullWidth size="lg" />
      {result ? (
        result.delivered ? (
          <InfoNote title={t('auth.resetSentTitle')} description={t('auth.resetSent')} icon="check-circle" />
        ) : (
          <InfoNote
            title={t('auth.resetUnavailableTitle')}
            description={t(result.reasonKey ?? 'auth.resetRequiresBackend')}
            tone="warning"
            icon="alert-circle"
          />
        )
      ) : null}
      <Link href="/sign-in" accessibilityRole="link" style={{ alignSelf: 'center' }}>
        <AppText variant="smallStrong" tone="primary">
          {t('auth.backToSignIn')}
        </AppText>
      </Link>
    </AuthLayout>
  );
}
