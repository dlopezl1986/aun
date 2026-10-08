import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useDialog } from '@/components/feedback/DialogProvider';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useLocale } from '@/hooks/useLocale';
import { useTheme } from '@/theme';
import { formatLongDate, formatTime } from '@/utils/date';
import { useDeleteEmail, useMailErrorMessage, useMailMessage, useMarkImportant, useMarkRead } from '../hooks';
import type { EmailAddress, EmailMessage } from '../types';
import type { ComposeMode } from './ComposeSheet';
import { MailBody } from './MailBody';
import { hasRemoteImages } from './mailHtml';

const formatSize = (n?: number) =>
  !n ? '' : n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
const people = (list: EmailAddress[]) => list.map((a) => a.name || a.address).join(', ');

interface Props {
  target: { accountId: string; id: string };
  onCompose: (mode: ComposeMode) => void;
  onClosed: () => void;
  onBack?: () => void;
}

export function MessageView({ target, onCompose, onClosed, onBack }: Props) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { spacing, colors, radius } = useTheme();
  const dialog = useDialog();
  const message = useMailMessage(target);
  const markRead = useMarkRead(true);
  const markReadVisible = useMarkRead();
  const important = useMarkImportant();
  const remove = useDeleteEmail();
  const errorMessage = useMailErrorMessage();
  const [allowImages, setAllowImages] = useState<string | null>(null);
  const m = message.data;

  // Opening an unread message marks it as read (once per message).
  const unreadId = m?.unread ? m.id : null;
  useEffect(() => {
    if (unreadId) markRead.mutate({ accountId: target.accountId, id: unreadId, read: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadId, target.accountId]);

  if (message.isLoading) return <LoadingState />;
  if (message.isError) return <ErrorState message={errorMessage(message.error)} onRetry={() => void message.refetch()} />;
  if (!m) return <EmptyState icon="mail" title={t('email.notFound')} />;

  const onDelete = async (msg: EmailMessage) => {
    const ok = await dialog.confirm({
      title: t('email.deleteTitle'),
      message: t('email.deleteMessage'),
      confirmLabel: t('email.actions.delete'),
      destructive: true,
    });
    if (ok) remove.mutate({ accountId: msg.accountId, id: msg.id }, { onSuccess: onClosed });
  };
  const date = new Date(m.receivedAt);
  const multiple = m.to.length + m.cc.length > 1;
  const imagesAllowed = allowImages === m.id;

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs }}>
        {onBack ? <IconButton icon="arrow-left" label={t('common.back')} onPress={onBack} /> : null}
        <Button
          label={t('email.actions.reply')}
          icon="corner-up-left"
          size="sm"
          variant="secondary"
          onPress={() => onCompose({ kind: 'reply', original: m })}
        />
        {multiple ? (
          <Button
            label={t('email.actions.replyAll')}
            icon="corner-up-left"
            size="sm"
            variant="ghost"
            onPress={() => onCompose({ kind: 'replyAll', original: m })}
          />
        ) : null}
        <Button
          label={t('email.actions.forward')}
          icon="corner-up-right"
          size="sm"
          variant="ghost"
          onPress={() => onCompose({ kind: 'forward', original: m })}
        />
        <View style={{ flex: 1 }} />
        <IconButton
          icon="mail"
          label={t('email.actions.markUnread')}
          onPress={() => markReadVisible.mutate({ accountId: m.accountId, id: m.id, read: false }, { onSuccess: onClosed })}
        />
        <IconButton
          icon="flag"
          color={m.important ? colors.warning : undefined}
          label={m.important ? t('email.actions.notImportant') : t('email.actions.important')}
          onPress={() => important.mutate({ accountId: m.accountId, id: m.id, important: !m.important })}
        />
        <IconButton icon="trash-2" label={t('email.actions.delete')} onPress={() => void onDelete(m)} />
      </View>

      <AppText variant="heading" accessibilityRole="header">
        {m.subject || t('email.noSubject')}
      </AppText>

      <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
        <Avatar name={m.from.name || m.from.address} size={40} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="bodyStrong" selectable>
            {m.from.name ? `${m.from.name} ` : ''}
            <AppText variant="small" tone="textMuted">
              {`<${m.from.address}>`}
            </AppText>
          </AppText>
          <AppText variant="small" tone="textMuted" selectable>
            {t('email.toLine', { list: people(m.to) })}
            {m.cc.length ? ` · ${t('email.ccLine', { list: people(m.cc) })}` : ''}
          </AppText>
          <AppText variant="caption" tone="textSubtle">
            {formatLongDate(date, locale)} · {formatTime(date, locale)}
          </AppText>
        </View>
      </View>

      {m.bodyHtml ? (
        <View style={{ gap: spacing.sm }}>
          {hasRemoteImages(m.bodyHtml) && !imagesAllowed ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                padding: spacing.sm,
                borderRadius: radius.md,
                backgroundColor: colors.surfaceMuted,
              }}
            >
              <Icon name="image" size={16} color={colors.textMuted} />
              <AppText variant="small" tone="textMuted" style={{ flex: 1 }}>
                {t('email.imagesBlocked')}
              </AppText>
              <Button label={t('email.showImages')} size="sm" variant="ghost" onPress={() => setAllowImages(m.id)} />
            </View>
          ) : null}
          <MailBody html={m.bodyHtml} allowRemoteImages={imagesAllowed} title={m.subject} />
        </View>
      ) : (
        <AppText variant="body" selectable>
          {m.bodyText}
        </AppText>
      )}

      {m.attachments.length ? (
        <View style={{ gap: spacing.xs }}>
          <AppText variant="overline" tone="textMuted">
            {t('email.attachments', { count: m.attachments.length })}
          </AppText>
          {m.attachments.map((a) => (
            <View key={a.name} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Icon name="paperclip" size={14} color={colors.textMuted} />
              <AppText variant="small" numberOfLines={1} style={{ flex: 1 }}>
                {a.name}
              </AppText>
              <AppText variant="caption" tone="textSubtle">
                {formatSize(a.size)}
              </AppText>
            </View>
          ))}
          <AppText variant="caption" tone="textSubtle">
            {t('email.attachmentsNote')}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}
