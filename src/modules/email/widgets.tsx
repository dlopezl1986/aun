import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { useLocale } from '@/hooks/useLocale';
import { SummaryTile } from '@/modules/dashboard/components/SummaryTile';
import { useTheme } from '@/theme';
import { mailDate } from './components/MessageList';
import { useEmailAccounts, useMailList } from './hooks';
import { emailMeta } from './meta';

const openEmail = () => router.navigate('/email');

/** Unread mail across every connected account (unified inbox, first page). */
function useUnread() {
  const accounts = useEmailAccounts();
  const connected = (accounts.data ?? []).filter((a) => a.state === 'connected');
  const list = useMailList({ kind: 'unified' }, connected.length > 0);
  const unread = useMemo(() => (list.data?.pages[0]?.items ?? []).filter((m) => m.unread), [list.data]);
  return { accounts, connected, unread, isLoading: accounts.isLoading || (connected.length > 0 && list.isLoading) };
}

export function EmailWidget() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { spacing } = useTheme();
  const { accounts, connected, unread, isLoading } = useUnread();
  return (
    <Card style={{ flex: 1 }}>
      <CardHeader
        title={t('email.widget.title')}
        icon={emailMeta.icon}
        accent={emailMeta.accent}
        actionLabel={t('common.open')}
        onAction={openEmail}
      />
      {isLoading ? (
        <LoadingState />
      ) : !accounts.data?.length ? (
        <EmptyState
          compact
          icon="inbox"
          accent={emailMeta.accent}
          title={t('email.noAccounts')}
          description={t('email.widget.connectHint')}
        />
      ) : !connected.length ? (
        <EmptyState
          compact
          icon="log-in"
          accent={emailMeta.accent}
          title={t('email.allExpired')}
          actionLabel={t('common.open')}
          onAction={openEmail}
        />
      ) : unread.length === 0 ? (
        <EmptyState compact icon="check-circle" accent={emailMeta.accent} title={t('email.widget.allRead')} />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {unread.slice(0, 4).map((m) => (
            <View key={`${m.accountId}:${m.id}`} style={{ gap: 1 }}>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <AppText variant="smallStrong" numberOfLines={1} style={{ flex: 1 }}>
                  {m.from.name || m.from.address}
                </AppText>
                <AppText variant="caption" tone="textSubtle">
                  {mailDate(m.receivedAt, locale)}
                </AppText>
              </View>
              <AppText variant="small" tone="textMuted" numberOfLines={1}>
                {m.subject || t('email.noSubject')}
              </AppText>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

export function EmailTodaySummary() {
  const { t } = useTranslation();
  const { accounts, connected, unread, isLoading } = useUnread();
  const count = accounts.data?.length ?? 0;
  return (
    <SummaryTile
      icon={emailMeta.icon}
      accent={emailMeta.accent}
      label={t('modules.email.title')}
      loading={isLoading}
      value={
        !count
          ? t('email.summary.none')
          : !connected.length
            ? t('email.summary.reconnect')
            : t('email.summary.unread', { count: unread.length })
      }
      details={!count ? [t('email.summary.hint')] : unread.slice(0, 2).map((m) => m.subject || t('email.noSubject'))}
      onPress={openEmail}
    />
  );
}
