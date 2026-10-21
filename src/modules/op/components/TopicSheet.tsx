import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useDialog } from '@/components/feedback/DialogProvider';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { TextField } from '@/components/ui/TextField';
import { Toggle } from '@/components/ui/Toggle';
import { useLocale } from '@/hooks/useLocale';
import { formatHours } from '@/modules/calendars/shiftHours';
import { useTheme } from '@/theme';
import { formatShortDate, fromDateKey } from '@/utils/date';
import { useRemoveTopic, useSetDay, useUpdateTopic } from '../hooks';
import type { OpSession, OpTopic } from '../types';
import { topicLabel } from './topicLabel';

function Body({
  topic,
  sessions,
  day,
  hours,
  onClose,
}: {
  topic: OpTopic;
  sessions: OpSession[];
  day: { date: string; session: OpSession | null };
  hours: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { spacing } = useTheme();
  const dialog = useDialog();
  const update = useUpdateTopic();
  const remove = useRemoveTopic();
  const setDay = useSetDay();
  const [title, setTitle] = useState(topic.title);
  const days = sessions.filter((s) => s.topicIds.includes(topic.id)).map((s) => s.date);
  const onDay = !!day.session?.topicIds.includes(topic.id);
  const dayName = formatShortDate(fromDateKey(day.date), locale);

  const toggleOnDay = () => {
    const ids = day.session?.topicIds ?? [];
    const next = onDay ? ids.filter((x) => x !== topic.id) : [...ids, topic.id];
    setDay.mutate({
      date: day.date,
      patch: { topicIds: next, doneTopicIds: (day.session?.doneTopicIds ?? []).filter((x) => next.includes(x)) },
    });
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={topicLabel(topic, t)}
      subtitle={days.length ? t('op.topic.summary', { count: days.length, hours: formatHours(hours, locale) }) : t('op.topic.neverPlanned')}
      footer={
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' }}>
          <Button
            label={t('common.delete')}
            icon="trash-2"
            variant="ghost"
            onPress={async () => {
              const ok = await dialog.confirm({
                title: t('op.topic.deleteTitle', { name: topicLabel(topic, t) }),
                message: t('op.topic.deleteMessage'),
                confirmLabel: t('common.delete'),
                destructive: true,
              });
              if (ok) remove.mutate(topic.id, { onSuccess: onClose });
            }}
          />
          <Button label={t('op.picker.done')} icon="check" onPress={onClose} />
        </View>
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <AppText variant="bodyStrong" style={{ flex: 1 }}>
          {t('op.topic.studied')}
        </AppText>
        <Toggle
          value={topic.studied}
          onValueChange={(studied) => update.mutate({ id: topic.id, patch: { studied } })}
          label={t('op.topic.studied')}
        />
      </View>
      <Button
        label={onDay ? t('op.topic.removeFromDay', { date: dayName }) : t('op.topic.addToDay', { date: dayName })}
        icon={onDay ? 'minus' : 'plus'}
        variant="secondary"
        loading={setDay.isPending}
        onPress={toggleOnDay}
      />
      <TextField
        label={t('op.topic.title')}
        value={title}
        onChangeText={setTitle}
        placeholder={t('op.topic.titlePlaceholder')}
        onBlur={() => title.trim() !== topic.title && update.mutate({ id: topic.id, patch: { title } })}
        onSubmitEditing={() => title.trim() !== topic.title && update.mutate({ id: topic.id, patch: { title } })}
      />
      {days.length ? (
        <AppText variant="small" tone="textMuted">
          {t('op.topic.days', { days: days.map((d) => formatShortDate(fromDateKey(d), locale)).join(', ') })}
        </AppText>
      ) : null}
    </Sheet>
  );
}

/** A topic of the syllabus: studied or not, its title, the days it was on, and add it to the day shown. */
export function TopicSheet(props: {
  topic: OpTopic | null;
  sessions: OpSession[];
  day: { date: string; session: OpSession | null };
  hours: number;
  onClose: () => void;
}) {
  if (!props.topic) return null;
  return <Body key={props.topic.id} {...props} topic={props.topic} />;
}
