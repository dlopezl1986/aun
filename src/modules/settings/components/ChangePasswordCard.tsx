import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useToast } from '@/components/feedback/ToastProvider';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { TextField } from '@/components/ui/TextField';
import { authGateway } from '@/services/auth';
import { MIN_PASSWORD_LENGTH } from '@/services/auth/localAuthGateway';
import { AuthError } from '@/services/auth/types';
import { useTheme } from '@/theme';

/** Settings → Perfil: change the password (the current one is checked first). */
export function ChangePasswordCard() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [saving, setSaving] = useState(false);
  const tooShort = next.length > 0 && next.length < MIN_PASSWORD_LENGTH;
  const mismatch = repeat.length > 0 && repeat !== next;
  const ready = !!current && next.length >= MIN_PASSWORD_LENGTH && repeat === next;

  const save = async () => {
    setSaving(true);
    try {
      await authGateway.changePassword(current, next);
      setCurrent('');
      setNext('');
      setRepeat('');
      toast.show(t('settings.password.changed'), 'success');
    } catch (e) {
      const code = e instanceof AuthError ? e.code : null;
      toast.show(
        t(
          code === 'invalid-credentials'
            ? 'settings.password.wrongCurrent'
            : code === 'weak-password'
              ? 'settings.password.tooShort'
              : code === 'rate-limited'
                ? 'auth.errors.rate-limited'
                : 'common.errorDescription',
          { count: MIN_PASSWORD_LENGTH },
        ),
        'error',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={{ gap: spacing.md }}>
      <CardHeader title={t('settings.password.title')} icon="lock" />
      <TextField
        label={t('settings.password.current')}
        value={current}
        onChangeText={setCurrent}
        secureTextEntry
        autoComplete="current-password"
        autoCapitalize="none"
      />
      <TextField
        label={t('settings.password.new')}
        value={next}
        onChangeText={setNext}
        secureTextEntry
        autoComplete="new-password"
        autoCapitalize="none"
        error={tooShort ? t('settings.password.tooShort', { count: MIN_PASSWORD_LENGTH }) : undefined}
      />
      <TextField
        label={t('settings.password.repeat')}
        value={repeat}
        onChangeText={setRepeat}
        secureTextEntry
        autoComplete="new-password"
        autoCapitalize="none"
        error={mismatch ? t('settings.password.mismatch') : undefined}
      />
      <Button label={t('settings.password.save')} icon="check" onPress={() => void save()} disabled={!ready} loading={saving} />
    </Card>
  );
}
