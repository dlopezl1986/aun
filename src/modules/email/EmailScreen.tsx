import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ChipGroup } from '@/components/forms/Chips';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon, type IconName } from '@/components/ui/Icon';
import { interaction } from '@/components/ui/interaction';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { TextField } from '@/components/ui/TextField';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useTheme } from '@/theme';
import { ComposeSheet, type ComposeMode } from './components/ComposeSheet';
import { MailAccounts } from './components/MailAccounts';
import { MessageList } from './components/MessageList';
import { MessageView } from './components/MessageView';
import { useEmailAccounts, useMailErrorMessage, useMailFolders, useMailList, type MailSelection } from './hooks';
import { emailMeta } from './meta';
import { providerDescriptor } from './providers';
import type { EmailAccount, EmailFolder, FolderRole } from './types';

const ROLE_ICONS: Record<FolderRole, IconName> = {
  inbox: 'inbox',
  sent: 'send',
  drafts: 'edit-3',
  trash: 'trash-2',
  spam: 'alert-octagon',
  archive: 'archive',
  important: 'flag',
  starred: 'star',
};

function NavItem({
  icon,
  label,
  count,
  active,
  onPress,
}: {
  icon: IconName;
  label: string;
  count?: number;
  active: boolean;
  onPress: () => void;
}) {
  const { colors, spacing, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      aria-selected={active}
      accessibilityLabel={count ? `${label}, ${count}` : label}
      style={(s) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        minHeight: 38,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: active ? colors.primarySoft : interaction(s).hovered ? colors.surfaceMuted : 'transparent',
      })}
    >
      <Icon name={icon} size={15} color={active ? colors.primary : colors.textMuted} />
      <AppText variant={active ? 'bodyStrong' : 'body'} tone={active ? 'primary' : 'text'} style={{ flex: 1 }} numberOfLines={1}>
        {label}
      </AppText>
      {count ? (
        <AppText variant="caption" tone="primary">
          {count}
        </AppText>
      ) : null}
    </Pressable>
  );
}

const folderLabel = (f: EmailFolder, t: (k: string) => string) => (f.role ? t(`email.folders.${f.role}`) : f.name);

function AccountFolders({
  account,
  selection,
  onSelect,
}: {
  account: EmailAccount;
  selection: MailSelection;
  onSelect: (s: MailSelection) => void;
}) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const folders = useMailFolders(account.id);
  const p = providerDescriptor(account.provider);
  return (
    <View style={{ gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, marginTop: spacing.md }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.color }} />
        <AppText variant="overline" tone="textMuted" numberOfLines={1} style={{ flex: 1 }}>
          {account.label} · {account.address}
        </AppText>
      </View>
      {folders.isLoading ? (
        <LoadingState />
      ) : folders.isError ? (
        <AppText variant="caption" tone="danger" style={{ paddingHorizontal: spacing.sm }}>
          {t('email.errors.auth-expired')}
        </AppText>
      ) : (
        (folders.data ?? []).map((f) => (
          <NavItem
            key={f.id}
            icon={f.role ? ROLE_ICONS[f.role] : 'folder'}
            label={folderLabel(f, t)}
            count={f.unread}
            active={selection.kind === 'folder' && selection.accountId === account.id && selection.folderId === f.id}
            onPress={() => onSelect({ kind: 'folder', accountId: account.id, folderId: f.id, name: folderLabel(f, t) })}
          />
        ))
      )}
    </View>
  );
}

/** Correo (sections 36–37): several Gmail/Outlook mailboxes, unified inbox, read/send/reply/forward. */
export function EmailScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { breakpoint, isCompact } = useBreakpoint();
  const accounts = useEmailAccounts();
  const errorMessage = useMailErrorMessage();
  const [tab, setTab] = useState<'mail' | 'accounts'>('mail');
  const [selection, setSelection] = useState<MailSelection>({ kind: 'unified' });
  const [open, setOpen] = useState<{ accountId: string; id: string } | null>(null);
  const [compose, setCompose] = useState<ComposeMode | null>(null);
  const [search, setSearch] = useState('');

  const connected = useMemo(() => (accounts.data ?? []).filter((a) => a.state === 'connected'), [accounts.data]);
  const all = accounts.data ?? [];
  const list = useMailList(selection, connected.length > 0);
  const messages = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data]);
  const failed = list.data?.pages[0]?.failed ?? [];
  const accountInfo = (id: string) => {
    const a = all.find((x) => x.id === id);
    return a ? { label: `${a.label} · ${a.address}`, color: providerDescriptor(a.provider).color } : undefined;
  };

  const select = (s: MailSelection) => {
    setSelection(s);
    setOpen(null);
  };
  const runSearch = () => (search.trim() ? select({ kind: 'search', query: search.trim() }) : select({ kind: 'unified' }));

  const header = (
    <PageHeader
      title={t('modules.email.title')}
      subtitle={t('email.subtitle')}
      icon={emailMeta.icon}
      accent={emailMeta.accent}
      actions={
        connected.length ? (
          <Button
            label={t('email.compose.new')}
            icon="edit-3"
            onPress={() => setCompose({ kind: 'new', accountId: selection.kind === 'folder' ? selection.accountId : undefined })}
          />
        ) : undefined
      }
    />
  );

  if (accounts.isLoading)
    return (
      <Screen>
        {header}
        <LoadingState />
      </Screen>
    );

  if (!all.length || tab === 'accounts') {
    return (
      <Screen>
        {header}
        {all.length ? (
          <SegmentedControl<'mail' | 'accounts'>
            accessibilityLabel={t('email.sections')}
            value={tab}
            onChange={setTab}
            options={[
              { value: 'mail', label: t('email.tabs.mail'), icon: 'inbox' },
              { value: 'accounts', label: t('email.tabs.accounts'), icon: 'at-sign' },
            ]}
          />
        ) : (
          <EmptyState icon="inbox" accent={emailMeta.accent} title={t('email.noAccounts')} description={t('email.noAccountsDescription')} />
        )}
        <MailAccounts />
      </Screen>
    );
  }

  const listTitle =
    selection.kind === 'unified'
      ? t('email.unified')
      : selection.kind === 'search'
        ? t('email.searchResults', { query: selection.query })
        : (selection.name ?? '');

  const nav = (
    <View style={{ gap: 2 }}>
      <NavItem icon="layers" label={t('email.unified')} active={selection.kind === 'unified'} onPress={() => select({ kind: 'unified' })} />
      {connected.map((a) => (
        <AccountFolders key={a.id} account={a} selection={selection} onSelect={select} />
      ))}
    </View>
  );

  const listPane = (
    <Card padded={false} style={isCompact ? { padding: spacing.sm } : { flex: 1, minWidth: 0, padding: spacing.sm }}>
      <View style={{ padding: spacing.sm, gap: spacing.sm }}>
        <TextField
          compact
          leftIcon="search"
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={runSearch}
          returnKeyType="search"
          placeholder={t('email.searchPlaceholder')}
          accessibilityLabel={t('email.searchPlaceholder')}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <AppText variant="subheading" style={{ flex: 1 }} numberOfLines={1}>
            {listTitle}
          </AppText>
          <Button
            label={t('common.refresh')}
            icon="refresh-cw"
            size="sm"
            variant="ghost"
            loading={list.isRefetching}
            onPress={() => void list.refetch()}
          />
        </View>
        {failed.map((f) => (
          <AppText key={f.accountId} variant="caption" tone="danger">
            {accountInfo(f.accountId)?.label}: {t(`email.errors.${f.code}`)}
          </AppText>
        ))}
      </View>
      {!connected.length ? (
        <EmptyState
          icon="log-in"
          title={t('email.allExpired')}
          description={t('email.allExpiredHint')}
          actionLabel={t('email.tabs.accounts')}
          onAction={() => setTab('accounts')}
        />
      ) : list.isLoading ? (
        <LoadingState />
      ) : list.isError ? (
        <ErrorState message={errorMessage(list.error)} onRetry={() => void list.refetch()} />
      ) : messages.length === 0 ? (
        <EmptyState
          icon="inbox"
          accent={emailMeta.accent}
          title={selection.kind === 'search' ? t('email.noResults') : t('email.emptyFolder')}
        />
      ) : (
        <MessageList
          messages={messages}
          selectedId={open?.id}
          onOpen={(m) => setOpen({ accountId: m.accountId, id: m.id })}
          accountLabel={selection.kind === 'folder' ? undefined : accountInfo}
          hasMore={list.hasNextPage}
          loadingMore={list.isFetchingNextPage}
          onLoadMore={() => void list.fetchNextPage()}
        />
      )}
    </Card>
  );

  const reader = open ? (
    <MessageView
      key={`${open.accountId}:${open.id}`}
      target={open}
      onCompose={setCompose}
      onClosed={() => setOpen(null)}
      onBack={isCompact ? () => setOpen(null) : undefined}
    />
  ) : (
    <EmptyState icon="mail" accent={emailMeta.accent} title={t('email.selectMessage')} />
  );

  const chips = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
      <ChipGroup<string>
        accessibilityLabel={t('email.mailboxes')}
        selected={selection.kind === 'folder' ? selection.accountId : selection.kind === 'unified' ? 'unified' : ''}
        onToggle={(v) =>
          v === 'unified'
            ? select({ kind: 'unified' })
            : select({
                kind: 'folder',
                accountId: v,
                folderId: 'inbox',
                name: `${t('email.folders.inbox')} · ${accountInfo(v)?.label ?? ''}`,
              })
        }
        options={[{ value: 'unified', label: t('email.unified') }, ...connected.map((a) => ({ value: a.id, label: a.label }))]}
      />
    </ScrollView>
  );

  const tabs = (
    <SegmentedControl<'mail' | 'accounts'>
      accessibilityLabel={t('email.sections')}
      value={tab}
      onChange={setTab}
      options={[
        { value: 'mail', label: t('email.tabs.mail'), icon: 'inbox' },
        { value: 'accounts', label: t('email.tabs.accounts'), icon: 'at-sign' },
      ]}
    />
  );

  let body;
  if (breakpoint === 'expanded' || breakpoint === 'wide') {
    body = (
      <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' }}>
        <Card style={{ width: 240 }} padded={false}>
          <View style={{ padding: spacing.sm }}>{nav}</View>
        </Card>
        {listPane}
        <Card style={{ flex: 1.3, minWidth: 0 }}>{reader}</Card>
      </View>
    );
  } else if (breakpoint === 'medium') {
    body = (
      <>
        {chips}
        <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' }}>
          {listPane}
          <Card style={{ flex: 1.2, minWidth: 0 }}>{reader}</Card>
        </View>
      </>
    );
  } else {
    body = open ? (
      <Card>{reader}</Card>
    ) : (
      <>
        {chips}
        {listPane}
      </>
    );
  }

  return (
    <Screen>
      {header}
      {tabs}
      {body}
      <ComposeSheet mode={compose} accounts={connected} onClose={() => setCompose(null)} />
    </Screen>
  );
}
