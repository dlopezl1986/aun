import { Platform, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useDialog } from '@/components/feedback/DialogProvider';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { InfoNote } from '@/components/ui/InfoNote';
import { useServices } from '@/services/ServicesProvider';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';
import { useConnectEmail, useDisconnectEmail, useEmailAccounts, useRenameEmailAccount } from '../hooks';
import { emailMeta } from '../meta';
import { emailProviders, providerDescriptor } from '../providers';
import type { EmailAccount } from '../types';

/** Connected mailboxes + "connect a new one", with each provider's real availability. */
export function MailAccounts() {
  const { t } = useTranslation();
  const { spacing, radius } = useTheme();
  const services = useServices();
  const dialog = useDialog();
  const accounts = useEmailAccounts();
  const connect = useConnectEmail();
  const disconnect = useDisconnectEmail();
  const rename = useRenameEmailAccount();

  const onRename = async (a: EmailAccount) => {
    const label = await dialog.prompt({
      title: t('email.accountsCard.rename'),
      label: t('email.accountsCard.labelName'),
      initialValue: a.label,
      confirmLabel: t('common.save'),
    });
    if (label && label !== a.label) rename.mutate({ id: a.id, label });
  };
  const onDisconnect = async (a: EmailAccount) => {
    const ok = await dialog.confirm({
      title: t('email.accountsCard.disconnectTitle', { address: a.address }),
      message: t('email.accountsCard.disconnectMessage'),
      confirmLabel: t('email.accountsCard.disconnect'),
      destructive: true,
    });
    if (ok) disconnect.mutate(a);
  };

  return (
    <Card>
      <CardHeader title={t('email.accounts')} icon="at-sign" accent={emailMeta.accent} />
      <View style={{ gap: spacing.sm }}>
        {(accounts.data ?? []).map((a) => {
          const p = providerDescriptor(a.provider);
          return (
            <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48 }}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: radius.md,
                  backgroundColor: withAlpha(p.color, 0.12),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name={p.icon} size={17} color={p.color} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText variant="bodyStrong" numberOfLines={1}>
                  {a.label}
                </AppText>
                <AppText variant="small" tone="textMuted" numberOfLines={1}>
                  {a.address}
                </AppText>
              </View>
              {a.state === 'connected' ? (
                <Badge label={t('email.accountsCard.connected')} tone="success" />
              ) : (
                <Button
                  label={t('email.accountsCard.reconnect')}
                  size="sm"
                  variant="secondary"
                  loading={connect.isPending}
                  onPress={() => connect.mutate(a.provider)}
                />
              )}
              <IconButton
                icon="edit-2"
                size={16}
                label={`${t('email.accountsCard.rename')}: ${a.address}`}
                onPress={() => void onRename(a)}
              />
              <IconButton
                icon="log-out"
                size={16}
                label={`${t('email.accountsCard.disconnect')}: ${a.address}`}
                onPress={() => void onDisconnect(a)}
              />
            </View>
          );
        })}

        <AppText variant="overline" tone="textMuted" style={{ marginTop: spacing.sm }}>
          {t('email.accountsCard.add')}
        </AppText>
        {emailProviders.map((p) => {
          let support: ReturnType<ReturnType<typeof services.email.provider>['support']>;
          try {
            support = services.email.provider(p.id).support();
          } catch {
            return null;
          }
          return (
            <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48 }}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: radius.md,
                  backgroundColor: withAlpha(p.color, 0.12),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name={p.icon} size={17} color={p.color} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText variant="bodyStrong">{p.name}</AppText>
                <AppText variant="small" tone="textMuted">
                  {p.devOnly
                    ? t('email.providers.demo')
                    : support.supported
                      ? t('email.providers.oauth')
                      : t(`email.providers.unavailable.${support.reason}`)}
                </AppText>
              </View>
              <Button
                label={t('email.accountsCard.connect')}
                icon="link"
                size="sm"
                variant={support.supported ? 'secondary' : 'ghost'}
                disabled={!support.supported}
                loading={connect.isPending && connect.variables === p.id}
                onPress={() => connect.mutate(p.id)}
              />
            </View>
          );
        })}
        <InfoNote
          title={t('email.security.title')}
          items={[
            t('email.security.oauth'),
            t('email.security.tokens'),
            ...(Platform.OS === 'web' ? [t('email.security.web')] : []),
            t('email.security.html'),
          ]}
        />
      </View>
    </Card>
  );
}
