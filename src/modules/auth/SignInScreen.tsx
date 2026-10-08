import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { InfoNote } from '@/components/ui/InfoNote';
import { TextField } from '@/components/ui/TextField';
import { authGateway } from '@/services/auth';
import { useAuthStore } from '@/state/authStore';
import { useTheme } from '@/theme';
import { isValidLogin } from '@/utils/validation';
import { AuthLayout } from './components/AuthLayout';
import { ProviderButtons } from './components/ProviderButtons';
import { useAuthErrorMessage } from './useAuthErrorMessage';

export function SignInScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const signIn = useAuthStore((s) => s.signIn);
  const errorMessage = useAuthErrorMessage();
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!isValidLogin(email, authGateway.allowsUsername) || !password) {
      setError(t('auth.errors.missingFields'));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (e) {
      setError(errorMessage(e));
      setLoading(false);
    }
  };

  return (
    <AuthLayout title={t('auth.signInTitle')} subtitle={t('auth.signInSubtitle')}>
      <TextField
        label={authGateway.allowsUsername ? t('auth.emailOrUsername') : t('auth.email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete={authGateway.allowsUsername ? 'username' : 'email'}
        keyboardType={authGateway.allowsUsername ? 'default' : 'email-address'}
        textContentType="emailAddress"
        leftIcon="mail"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        submitBehavior="submit"
      />
      <TextField
        ref={passwordRef}
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        revealable
        autoComplete="current-password"
        textContentType="password"
        leftIcon="lock"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
      />
      <View style={{ alignItems: 'flex-end', marginTop: -spacing.sm }}>
        <Link href="/forgot-password" accessibilityRole="link">
          <AppText variant="smallStrong" tone="primary">
            {t('auth.forgotPassword')}
          </AppText>
        </Link>
      </View>
      {error ? (
        <AppText variant="smallStrong" tone="danger" accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
      <Button label={t('auth.signIn')} onPress={() => void submit()} loading={loading} fullWidth size="lg" />
      <ProviderButtons />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
        <AppText variant="small" tone="textMuted">
          {t('auth.noAccount')}
        </AppText>
        <Link href="/sign-up" accessibilityRole="link">
          <AppText variant="smallStrong" color={colors.primary}>
            {t('auth.createAccount')}
          </AppText>
        </Link>
      </View>
      {authGateway.isLocalOnly ? <InfoNote title={t('auth.localModeTitle')} description={t('auth.localMode')} icon="smartphone" /> : null}
    </AuthLayout>
  );
}
