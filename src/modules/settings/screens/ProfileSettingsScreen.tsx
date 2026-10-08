import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useToast } from '@/components/feedback/ToastProvider';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { InfoNote } from '@/components/ui/InfoNote';
import { TextField } from '@/components/ui/TextField';
import { useSignOut } from '@/hooks/useSignOut';
import { authGateway } from '@/services/auth';
import { useAuthStore, useCurrentUser } from '@/state/authStore';
import { useTheme } from '@/theme';
import { SettingsPage } from '../components/SettingsPage';

export function ProfileSettingsScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const toast = useToast();
  const user = useCurrentUser();
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const signOut = useSignOut();
  const [name, setName] = useState(user.displayName);
  const [saving, setSaving] = useState(false);
  const dirty = name.trim() !== user.displayName && !!name.trim();

  const save = async () => {
    setSaving(true);
    try {
      await updateProfile({ displayName: name });
      toast.show(t('common.saved'));
    } catch {
      toast.show(t('common.errorDescription'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsPage title={t('settings.profile.title')} subtitle={t('settings.profile.subtitle')}>
      <Card style={{ gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
          <Avatar name={name || user.email} size={64} />
          <View style={{ gap: spacing.xs }}>
            {user.methods.map((m) => (
              <Badge key={m} label={t(`auth.methods.${m}`)} tone="primary" icon="key" />
            ))}
          </View>
        </View>
        <TextField label={t('auth.displayName')} value={name} onChangeText={setName} />
        <TextField label={t('auth.email')} value={user.email} editable={false} hint={t('settings.profile.emailHint')} />
        <Button label={t('common.save')} onPress={() => void save()} disabled={!dirty} loading={saving} />
      </Card>
      {authGateway.isLocalOnly ? (
        <InfoNote title={t('settings.localData.title')} description={t('settings.profile.localAccount')} icon="smartphone" />
      ) : null}
      <Button label={t('auth.signOut')} variant="secondary" icon="log-out" onPress={() => void signOut()} />
    </SettingsPage>
  );
}
