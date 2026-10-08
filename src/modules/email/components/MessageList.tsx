import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { Icon } from '@/components/ui/Icon';
import { interaction } from '@/components/ui/interaction';
import { useLocale } from '@/hooks/useLocale';
import { useTheme } from '@/theme';
import { formatShortDate, formatTime, isSameDay } from '@/utils/date';
import type { EmailSummary } from '../types';

export function mailDate(iso: string, locale: string): string {
  const d = new Date(iso);
  return isSameDay(d, new Date()) ? formatTime(d, locale) : formatShortDate(d, locale);
}

interface RowProps {
  message: EmailSummary;
  selected: boolean;
  onPress: () => void;
  /** Account label shown in the unified inbox. */
  accountLabel?: string;
  accountColor?: string;
}

function MessageRow({ message: m, selected, onPress, accountLabel, accountColor }: RowProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { colors, spacing, radius } = useTheme();
  const sender = m.from.name || m.from.address;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      aria-selected={selected}
      accessibilityLabel={[m.unread ? t('email.unread') : null, sender, m.subject || t('email.noSubject'), mailDate(m.receivedAt, locale)]
        .filter(Boolean)
        .join(', ')}
      style={(s) => ({
        flexDirection: 'row',
        gap: spacing.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderRadius: radius.md,
        backgroundColor: selected ? colors.primarySoft : interaction(s).hovered ? colors.surfaceMuted : 'transparent',
      })}
    >
      <View style={{ width: 8, alignItems: 'center', paddingTop: 14 }}>
        {m.unread ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} /> : null}
      </View>
      <Avatar name={sender} size={36} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <AppText variant={m.unread ? 'bodyStrong' : 'body'} numberOfLines={1} style={{ flex: 1 }}>
            {sender}
          </AppText>
          {m.important ? <Icon name="flag" size={13} color={colors.warning} /> : null}
          {m.hasAttachments ? <Icon name="paperclip" size={13} color={colors.textSubtle} /> : null}
          <AppText variant="caption" tone={m.unread ? 'primary' : 'textSubtle'}>
            {mailDate(m.receivedAt, locale)}
          </AppText>
        </View>
        <AppText variant={m.unread ? 'smallStrong' : 'small'} numberOfLines={1}>
          {m.subject || t('email.noSubject')}
        </AppText>
        <AppText variant="small" tone="textMuted" numberOfLines={1}>
          {m.snippet}
        </AppText>
        {accountLabel ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accountColor ?? colors.textSubtle }} />
            <AppText variant="caption" tone="textSubtle" numberOfLines={1}>
              {accountLabel}
            </AppText>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

interface Props {
  messages: EmailSummary[];
  selectedId?: string | null;
  onOpen: (m: EmailSummary) => void;
  accountLabel?: (accountId: string) => { label: string; color: string } | undefined;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}

export function MessageList({ messages, selectedId, onOpen, accountLabel, hasMore, loadingMore, onLoadMore }: Props) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  return (
    <View>
      {messages.map((m, i) => {
        const acc = accountLabel?.(m.accountId);
        return (
          <View key={`${m.accountId}:${m.id}`}>
            {i > 0 ? <Divider inset={60} /> : null}
            <MessageRow
              message={m}
              selected={m.id === selectedId}
              onPress={() => onOpen(m)}
              accountLabel={acc?.label}
              accountColor={acc?.color}
            />
          </View>
        );
      })}
      {hasMore ? (
        <View style={{ padding: spacing.md, alignItems: 'center' }}>
          <Button label={t('email.loadMore')} variant="ghost" size="sm" loading={loadingMore} onPress={onLoadMore} />
        </View>
      ) : null}
    </View>
  );
}
