import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { authGateway } from '@/services/auth';
import { useAuthStore } from '@/state/authStore';
import { useTheme } from '@/theme';

/**
 * Google / Apple sign-in. Rendered from the gateway's availability so the
 * buttons are honest: disabled with a reason until the backend exists.
 */
export function ProviderButtons() {
  const { t } = useTranslation();
  const { spacing, colors } = useTheme();
  const signInWithProvider = useAuthStore((s) => s.signInWithProvider);
  const providers = authGateway.getAvailability().filter((a) => a.method !== 'password');
  const anyUnavailable = providers.some((p) => !p.available);

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        <AppText variant="caption" tone="textSubtle">
          {t('auth.or')}
        </AppText>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      </View>
      {providers.map((p) => (
        <Button
          key={p.method}
          label={t(`auth.continueWith.${p.method}`)}
          icon={p.method === 'google' ? 'chrome' : 'smartphone'}
          variant="secondary"
          fullWidth
          disabled={!p.available}
          accessibilityHint={p.reasonKey ? t(p.reasonKey) : undefined}
          onPress={() => void signInWithProvider(p.method as 'google' | 'apple')}
        />
      ))}
      {anyUnavailable ? (
        <AppText variant="caption" tone="textSubtle" align="center">
          {t('auth.providerRequiresBackend')}
        </AppText>
      ) : null}
    </View>
  );
}
