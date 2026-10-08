import { Link } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { authGateway, MIN_PASSWORD_LENGTH } from '@/services/auth';
import { useAuthStore } from '@/state/authStore';
import { isValidLogin } from '@/utils/validation';
import { AuthLayout } from './components/AuthLayout';
import { ProviderButtons } from './components/ProviderButtons';
import { useAuthErrorMessage } from './useAuthErrorMessage';

export function SignUpScreen() {
  const { t } = useTranslation();
  const signUp = useAuthStore((s) => s.signUp);
  const errorMessage = useAuthErrorMessage();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fieldErrors = {
    name: !name.trim() ? t('auth.errors.nameRequired') : null,
    email: !isValidLogin(email, authGateway.allowsUsername)
      ? t(authGateway.allowsUsername ? 'auth.errors.invalid-login' : 'auth.errors.invalid-email')
      : null,
    password: password.length < MIN_PASSWORD_LENGTH ? t('auth.errors.weak-password', { min: MIN_PASSWORD_LENGTH }) : null,
    confirm: confirm !== password ? t('auth.errors.passwordMismatch') : null,
  };
  const valid = Object.values(fieldErrors).every((e) => !e);

  const submit = async () => {
    setTouched(true);
    if (!valid) return;
    setError(null);
    setLoading(true);
    try {
      await signUp({ email, password, displayName: name });
    } catch (e) {
      setError(errorMessage(e));
      setLoading(false);
    }
  };

  const show = (k: keyof typeof fieldErrors) => (touched ? fieldErrors[k] : null);

  return (
    <AuthLayout title={t('auth.signUpTitle')} subtitle={t('auth.signUpSubtitle')}>
      <TextField
        label={t('auth.displayName')}
        value={name}
        onChangeText={setName}
        leftIcon="user"
        autoComplete="name"
        error={show('name')}
      />
      <TextField
        label={authGateway.allowsUsername ? t('auth.emailOrUsername') : t('auth.email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete={authGateway.allowsUsername ? 'username' : 'email'}
        keyboardType={authGateway.allowsUsername ? 'default' : 'email-address'}
        leftIcon="mail"
        error={show('email')}
      />
      <TextField
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        revealable
        autoComplete="new-password"
        textContentType="newPassword"
        leftIcon="lock"
        hint={t('auth.passwordHint', { min: MIN_PASSWORD_LENGTH })}
        error={show('password')}
      />
      <TextField
        label={t('auth.confirmPassword')}
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        revealable
        autoComplete="new-password"
        leftIcon="lock"
        error={show('confirm')}
        onSubmitEditing={() => void submit()}
      />
      {error ? (
        <AppText variant="smallStrong" tone="danger" accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
      <Button label={t('auth.createAccount')} onPress={() => void submit()} loading={loading} fullWidth size="lg" />
      <ProviderButtons />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
        <AppText variant="small" tone="textMuted">
          {t('auth.haveAccount')}
        </AppText>
        <Link href="/sign-in" accessibilityRole="link">
          <AppText variant="smallStrong" tone="primary">
            {t('auth.signIn')}
          </AppText>
        </Link>
      </View>
    </AuthLayout>
  );
}
