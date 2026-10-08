import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { InfoNote } from '@/components/ui/InfoNote';
import { LoadingState } from '@/components/ui/States';
import { backendKind } from '@/services/backend';
import { FirebaseSharingService, SharingError } from '@/services/sharing/firebaseSharing';
import { pendingInvite } from '@/services/sharing/pendingInvite';
import { familySpaceId, type Invite } from '@/services/sharing/spaces';
import { useAuthStore } from '@/state/authStore';
import { CanvasScope, useTheme } from '@/theme';
import { familyMeta } from './meta';

type Status = 'loading' | 'ready' | 'accepting' | 'error';

/**
 * /join?code=…: someone invites you to their family. Signed out, the code is
 * kept until you create your account or sign in; then you accept it here.
 */
export function JoinScreen() {
  const { t } = useTranslation();
  const { spacing, colors } = useTheme();
  const params = useLocalSearchParams<{ code?: string }>();
  const code = typeof params.code === 'string' ? params.code : '';
  const user = useAuthStore((s) => s.session?.user ?? null);
  const [status, setStatus] = useState<Status>('loading');
  const [invite, setInvite] = useState<Invite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sharing = useMemo(() => (user && backendKind === 'firebase' ? new FirebaseSharingService(user.id) : null), [user]);

  useEffect(() => {
    if (!code) return;
    if (!user) {
      void pendingInvite.set(code);
      return;
    }
    if (!sharing) return;
    sharing
      .getInvite(code)
      .then((inv) => {
        setInvite(inv);
        if (inv.ownerId === user.id) throw new SharingError('own');
        if (inv.usedBy && inv.usedBy !== user.id) throw new SharingError('used');
        if (new Date(inv.expiresAt).getTime() < Date.now()) throw new SharingError('expired');
        setStatus('ready');
      })
      .catch((e) => {
        setError(e instanceof SharingError ? e.code : 'unknown');
        setStatus('error');
      });
  }, [code, user, sharing]);

  const goToFamily = () => {
    void pendingInvite.clear();
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Full reload: the app starts again and syncs everything just shared with you.
      const base = (Constants.expoConfig?.experiments as { baseUrl?: string } | undefined)?.baseUrl ?? '';
      window.location.assign(`${base}/family?joined=1`);
    } else router.replace({ pathname: '/family', params: { joined: '1' } });
  };

  const accept = async () => {
    if (!sharing) return;
    setStatus('accepting');
    try {
      await sharing.acceptInvite(code);
      goToFamily();
    } catch (e) {
      setError(e instanceof SharingError ? e.code : 'unknown');
      setStatus('error');
    }
  };

  let body: React.ReactNode;
  if (backendKind !== 'firebase')
    body = <InfoNote icon="cloud" title={t('sharing.join.cloudOnlyTitle')} description={t('sharing.join.cloudOnly')} />;
  else if (!code) body = <InfoNote icon="alert-triangle" title={t('sharing.join.errors.not-found')} tone="warning" />;
  else if (!user)
    body = (
      <View style={{ gap: spacing.md }}>
        <AppText variant="body">{t('sharing.join.signInFirst')}</AppText>
        <Button label={t('auth.createAccount')} icon="user-plus" fullWidth onPress={() => router.push('/sign-up')} />
        <Button label={t('auth.signIn')} variant="secondary" fullWidth onPress={() => router.push('/sign-in')} />
      </View>
    );
  else if (status === 'loading') body = <LoadingState />;
  else if (status === 'error')
    body = (
      <View style={{ gap: spacing.md }}>
        <InfoNote icon="alert-triangle" tone="warning" title={t(`sharing.join.errors.${error ?? 'unknown'}`)} />
        <Button
          label={t('sharing.join.goHome')}
          variant="secondary"
          onPress={() => {
            void pendingInvite.clear();
            router.replace('/');
          }}
        />
      </View>
    );
  else if (invite) {
    const items = Object.entries(invite.grants).map(([spaceId, role]) => ({
      spaceId,
      role,
      name: spaceId === familySpaceId(invite.ownerId) ? t('sharing.familyAndShopping') : (invite.spaceNames[spaceId] ?? ''),
      yours: invite.assign === spaceId,
    }));
    body = (
      <View style={{ gap: spacing.md }}>
        <AppText variant="title">{t('sharing.join.title', { name: invite.ownerName || t('sharing.someone') })}</AppText>
        <AppText variant="body" tone="textMuted">
          {t('sharing.join.subtitle', { account: user.email })}
        </AppText>
        <View style={{ gap: spacing.sm }}>
          {items.map((i) => (
            <View key={i.spaceId} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Icon name={i.spaceId.startsWith('fam_') ? 'users' : 'calendar'} size={18} color={familyMeta.accent} />
              <AppText variant="bodyStrong" style={{ flex: 1 }}>
                {i.name}
                {i.yours ? ` · ${t('sharing.yourCalendar')}` : ''}
              </AppText>
              <AppText variant="small" tone="textMuted">
                {t(`sharing.roles.${i.role}`)}
              </AppText>
            </View>
          ))}
        </View>
        <InfoNote icon="shield" title={t('sharing.privacyTitle')} description={t('sharing.join.privacy')} />
        <Button label={t('sharing.join.accept')} icon="check" fullWidth onPress={() => void accept()} loading={status === 'accepting'} />
        <Button
          label={t('sharing.join.notNow')}
          variant="ghost"
          fullWidth
          onPress={() => {
            void pendingInvite.clear();
            router.replace('/');
          }}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <CanvasScope>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}>
          <View style={{ width: '100%', maxWidth: 480 }}>
            <Card>{body}</Card>
          </View>
        </ScrollView>
      </CanvasScope>
    </View>
  );
}
