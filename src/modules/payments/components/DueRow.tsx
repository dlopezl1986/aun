import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { interaction } from '@/components/ui/interaction';
import { useLocale } from '@/hooks/useLocale';
import { useTheme } from '@/theme';
import { fromDateKey, type DateKey } from '@/utils/date';
import { withAlpha } from '@/utils/color';
import { occurrenceLabel, relativeDay } from '../describe';
import { useMoney } from '../hooks';
import type { Occurrence } from '../schedule';
import { categoryOf } from '../types';
import { PrivateMark } from './PrivateMark';

interface DueRowProps {
  occurrence: Occurrence;
  today: DateKey;
  onToggle?: () => void;
  onOpen?: () => void;
  compact?: boolean;
}

/** One due date: date block, what it is, how much, and a tick to mark it paid. */
export function DueRow({ occurrence: o, today, onToggle, onOpen, compact }: DueRowProps) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const locale = useLocale();
  const money = useMoney();
  const cat = categoryOf(o.payment.categoryId);
  const d = fromDateKey(o.date);
  const late = !o.paid && o.date < today;
  const when = relativeDay(t, o.date, today);
  const tone = o.paid ? colors.textSubtle : late ? colors.danger : colors.text;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: compact ? 44 : 56 }}>
      <Pressable
        onPress={onOpen}
        disabled={!onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${o.payment.title}, ${money(o.payment.amount)}, ${when}`}
        style={(s) => ({
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          opacity: interaction(s).pressed ? 0.7 : 1,
        })}
      >
        <View
          style={{
            width: compact ? 40 : 46,
            paddingVertical: spacing.xs,
            borderRadius: radius.md,
            alignItems: 'center',
            backgroundColor: late ? colors.dangerSoft : withAlpha(cat.color, o.paid ? 0.06 : 0.12),
          }}
        >
          <AppText variant={compact ? 'subheading' : 'heading'} color={late ? colors.danger : o.paid ? colors.textSubtle : cat.color}>
            {d.getDate()}
          </AppText>
          <AppText variant="overline" color={late ? colors.danger : colors.textMuted}>
            {d.toLocaleDateString(locale, { month: 'short' }).replace('.', '')}
          </AppText>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <AppText
              variant="bodyStrong"
              numberOfLines={1}
              color={tone}
              style={[{ flexShrink: 1 }, o.paid ? { textDecorationLine: 'line-through' } : null]}
            >
              {`${cat.emoji} ${o.payment.title}`}
            </AppText>
            <PrivateMark visible={o.payment.private} />
          </View>
          <AppText variant="caption" numberOfLines={1} color={late ? colors.danger : colors.textMuted}>
            {o.paid
              ? `${t('payments.paid')} · ${occurrenceLabel(t, o)}`
              : late
                ? `${t('payments.overdue')} · ${when}`
                : `${when} · ${occurrenceLabel(t, o)}`}
          </AppText>
        </View>
        <AppText variant={compact ? 'bodyStrong' : 'subheading'} color={tone}>
          {money(o.payment.amount)}
        </AppText>
      </Pressable>
      {onToggle ? (
        <Pressable
          onPress={onToggle}
          accessibilityRole="checkbox"
          aria-checked={o.paid}
          accessibilityLabel={
            o.paid ? t('payments.unmarkPaid', { title: o.payment.title }) : t('payments.markPaid', { title: o.payment.title })
          }
          hitSlop={8}
          style={(s) => ({
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: o.paid ? 0 : 2,
            borderColor: late ? colors.danger : interaction(s).hovered ? colors.success : colors.borderStrong,
            backgroundColor: o.paid ? colors.success : interaction(s).hovered ? colors.successSoft : 'transparent',
          })}
        >
          <Icon name="check" size={16} color={o.paid ? '#FFFFFF' : late ? colors.danger : colors.textSubtle} />
        </Pressable>
      ) : null}
    </View>
  );
}
