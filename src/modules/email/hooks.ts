import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { OAuthError } from '@/services/oauth/oauthClient';
import { useServices } from '@/services/ServicesProvider';
import { useDataMutation, useDataQuery } from '@/state/queryClient';
import { EmailError, type EmailAddress, type EmailMessage, type EmailProviderId, type OutgoingEmail } from './types';

/** Where the message list is pointed at. */
export type MailSelection =
  { kind: 'unified' } | { kind: 'folder'; accountId: string; folderId: string; name?: string } | { kind: 'search'; query: string };

export function useEmailAccounts() {
  return useDataQuery('email', ['accounts'], (s) => s.email.accountsWithState());
}

export function useMailFolders(accountId: string | null) {
  return useDataQuery('email', ['folders', accountId], (s) => (accountId ? s.email.listFolders(accountId) : Promise.resolve([])));
}

/** Pages of a folder (cursor-based) or a single merged page for unified/search. */
export function useMailList(selection: MailSelection, enabled = true) {
  const services = useServices();
  return useInfiniteQuery({
    queryKey: ['u', services.userId, 'email', 'list', selection],
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      if (selection.kind === 'folder') {
        const page = await services.email.listMessages(selection.accountId, selection.folderId, pageParam);
        return { items: page.items, next: page.next, failed: [] as { accountId: string; code: EmailError['code'] }[] };
      }
      const merged = selection.kind === 'unified' ? await services.email.unifiedInbox() : await services.email.search(selection.query);
      return { items: merged.items, next: undefined, failed: merged.failed };
    },
    getNextPageParam: (last) => last.next,
  });
}

export function useMailMessage(ref: { accountId: string; id: string } | null) {
  return useDataQuery('email', ['message', ref?.accountId, ref?.id], (s) =>
    ref ? s.email.getMessage(ref.accountId, ref.id) : Promise.resolve(null),
  );
}

/** Human message for mail/OAuth failures. */
export function useMailErrorMessage() {
  const { t } = useTranslation();
  return (e: unknown): string => {
    if (e instanceof OAuthError) return t(`email.errors.oauth.${e.code}`);
    if (e instanceof EmailError) return t(`email.errors.${e.code}`);
    return t('common.errorDescription');
  };
}

export function useConnectEmail() {
  const { t } = useTranslation();
  const errorMessage = useMailErrorMessage();
  return useDataMutation((s, providerId: EmailProviderId) => s.email.connect(providerId), {
    invalidate: ['email'],
    successMessage: (r) =>
      r
        ? r.isNew
          ? t('email.toast.connected', { address: r.account.address })
          : t('email.toast.reconnected')
        : t('email.toast.cancelled'),
    errorMessage,
  });
}

export function useDisconnectEmail() {
  const { t } = useTranslation();
  return useDataMutation((s, account: Parameters<typeof s.email.disconnect>[0]) => s.email.disconnect(account), {
    invalidate: ['email'],
    successMessage: t('email.toast.disconnected'),
  });
}

export function useRenameEmailAccount() {
  const { t } = useTranslation();
  return useDataMutation((s, v: { id: string; label: string }) => s.email.renameAccount(v.id, v.label), {
    invalidate: ['email'],
    successMessage: t('common.saved'),
  });
}

export type ComposeAction =
  | { kind: 'new'; accountId: string; message: OutgoingEmail }
  | { kind: 'reply'; accountId: string; original: EmailMessage; body: string; all: boolean }
  | { kind: 'forward'; accountId: string; original: EmailMessage; to: EmailAddress[]; body: string };

export function useSendEmail() {
  const { t } = useTranslation();
  const errorMessage = useMailErrorMessage();
  return useDataMutation(
    (s, a: ComposeAction) =>
      a.kind === 'new'
        ? s.email.send(a.accountId, a.message)
        : a.kind === 'reply'
          ? s.email.reply(a.accountId, a.original, a.body, a.all)
          : s.email.forward(a.accountId, a.original, a.to, a.body),
    { invalidate: ['email'], successMessage: t('email.toast.sent'), errorMessage },
  );
}

export function useDeleteEmail() {
  const { t } = useTranslation();
  const errorMessage = useMailErrorMessage();
  return useDataMutation((s, v: { accountId: string; id: string }) => s.email.delete(v.accountId, v.id), {
    invalidate: ['email'],
    successMessage: t('email.toast.trashed'),
    errorMessage,
  });
}

export function useMarkRead(silent = false) {
  const errorMessage = useMailErrorMessage();
  return useDataMutation((s, v: { accountId: string; id: string; read: boolean }) => s.email.markRead(v.accountId, v.id, v.read), {
    invalidate: ['email'],
    errorMessage: silent ? () => '' : errorMessage,
  });
}

export function useMarkImportant() {
  const errorMessage = useMailErrorMessage();
  return useDataMutation(
    (s, v: { accountId: string; id: string; important: boolean }) => s.email.markImportant(v.accountId, v.id, v.important),
    {
      invalidate: ['email'],
      errorMessage,
    },
  );
}
