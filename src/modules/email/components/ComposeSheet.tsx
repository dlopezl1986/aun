import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ChipGroup } from '@/components/forms/Chips';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { TextField } from '@/components/ui/TextField';
import { useTheme } from '@/theme';
import { useSendEmail } from '../hooks';
import { isEmail, parseAddressList, replyAllCc } from '../providers/http';
import { prefixSubject } from '../providers/mime';
import type { EmailAccount, EmailAddress, EmailMessage } from '../types';

export type ComposeMode = { kind: 'new'; accountId?: string } | { kind: 'reply' | 'replyAll' | 'forward'; original: EmailMessage };

const show = (list: EmailAddress[]) => list.map((a) => (a.name ? `${a.name} <${a.address}>` : a.address)).join(', ');

function Composer({ mode, accounts, onClose }: { mode: ComposeMode; accounts: EmailAccount[]; onClose: () => void }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const send = useSendEmail();
  const replying = mode.kind === 'reply' || mode.kind === 'replyAll';
  const original = mode.kind === 'new' ? null : mode.original;
  const me = original ? accounts.find((a) => a.id === original.accountId) : undefined;
  const [accountId, setAccountId] = useState(
    original?.accountId ?? (mode.kind === 'new' ? mode.accountId : undefined) ?? accounts[0]?.id ?? '',
  );
  const [to, setTo] = useState(replying && original ? show([original.from]) : '');
  const [cc, setCc] = useState(mode.kind === 'replyAll' && original ? show(replyAllCc(original, me?.address ?? '')) : '');
  const [showCc, setShowCc] = useState(!!cc);
  const [subject, setSubject] = useState(original ? prefixSubject(mode.kind === 'forward' ? 'Fwd' : 'Re', original.subject) : '');
  const [body, setBody] = useState('');
  const [touched, setTouched] = useState(false);

  const toList = parseAddressList(to);
  const ccList = parseAddressList(cc);
  const invalid = [...toList, ...ccList].filter((a) => !isEmail(a.address));
  const toError =
    touched &&
    (!toList.length
      ? t('email.compose.toRequired')
      : invalid.length
        ? t('email.compose.invalid', { list: invalid.map((a) => a.address).join(', ') })
        : null);
  const canSend =
    !!accountId && toList.length > 0 && invalid.length === 0 && (replying || mode.kind === 'forward' || subject.trim() || body.trim());

  const submit = () => {
    setTouched(true);
    if (!canSend) return;
    const done = { onSuccess: onClose };
    if (mode.kind === 'new') send.mutate({ kind: 'new', accountId, message: { to: toList, cc: ccList, subject, body } }, done);
    else if (mode.kind === 'forward') send.mutate({ kind: 'forward', accountId, original: mode.original, to: toList, body }, done);
    else send.mutate({ kind: 'reply', accountId, original: mode.original, body, all: mode.kind === 'replyAll' }, done);
  };

  const title =
    mode.kind === 'new'
      ? t('email.compose.new')
      : mode.kind === 'forward'
        ? t('email.actions.forward')
        : mode.kind === 'replyAll'
          ? t('email.actions.replyAll')
          : t('email.actions.reply');

  return (
    <Sheet
      visible
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button label={t('common.cancel')} variant="ghost" onPress={onClose} />
          <Button label={t('email.compose.send')} icon="send" onPress={submit} disabled={touched && !canSend} loading={send.isPending} />
        </>
      }
    >
      {mode.kind === 'new' && accounts.length > 1 ? (
        <View style={{ gap: spacing.xs }}>
          <AppText variant="smallStrong" tone="textMuted">
            {t('email.compose.from')}
          </AppText>
          <ChipGroup<string>
            accessibilityLabel={t('email.compose.from')}
            selected={accountId}
            onToggle={setAccountId}
            options={accounts.map((a) => ({ value: a.id, label: `${a.label} · ${a.address}` }))}
          />
        </View>
      ) : (
        <AppText variant="small" tone="textMuted">
          {t('email.compose.fromAccount', { address: accounts.find((a) => a.id === accountId)?.address ?? '' })}
        </AppText>
      )}
      <TextField
        label={t('email.compose.to')}
        value={to}
        onChangeText={setTo}
        editable={!replying}
        placeholder="ana@example.com, Luis <luis@example.com>"
        keyboardType="email-address"
        autoCapitalize="none"
        autoFocus={!replying}
        error={toError || null}
        hint={replying ? undefined : t('email.compose.toHint')}
      />
      {showCc ? (
        <TextField
          label={t('email.compose.cc')}
          value={cc}
          onChangeText={setCc}
          editable={!replying}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      ) : mode.kind === 'new' || mode.kind === 'forward' ? (
        <Button
          label={t('email.compose.addCc')}
          variant="ghost"
          size="sm"
          icon="plus"
          onPress={() => setShowCc(true)}
          style={{ alignSelf: 'flex-start' }}
        />
      ) : null}
      <TextField label={t('email.compose.subject')} value={subject} onChangeText={setSubject} editable={mode.kind === 'new'} />
      <TextField
        label={t('email.compose.body')}
        value={body}
        onChangeText={setBody}
        multiline
        autoFocus={replying}
        placeholder={original ? t('email.compose.quoteHint') : undefined}
        numberOfLines={8}
      />
    </Sheet>
  );
}

export function ComposeSheet({ mode, accounts, onClose }: { mode: ComposeMode | null; accounts: EmailAccount[]; onClose: () => void }) {
  return mode ? <Composer mode={mode} accounts={accounts} onClose={onClose} /> : null;
}
