import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ChipGroup } from '@/components/forms/Chips';
import { useDialog } from '@/components/feedback/DialogProvider';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Sheet } from '@/components/ui/Sheet';
import { TextField } from '@/components/ui/TextField';
import { useLocale } from '@/hooks/useLocale';
import { useTheme } from '@/theme';
import { formatLongDate, formatShortDate, fromDateKey } from '@/utils/date';
import { useCarriedNotes, useRemoveSession, useSaveSession } from '../hooks';
import { opMeta } from '../meta';
import type { OpSession, OpTopic } from '../types';
import { topicLabel } from './topicLabel';

/** "2,5" / "2.5" → 2.5; empty → null (no hours); anything else → undefined (invalid). */
export function parseStudyHours(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && n <= 24 ? n : undefined;
}

/** What the previous study day left for this one ("se quedó atrás", "para mañana"). */
export function CarriedNotes({ session }: { session: OpSession }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { spacing, colors, radius } = useTheme();
  return (
    <View style={{ gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.warningSoft }}>
      <AppText variant="smallStrong" color={colors.warning}>
        {t('op.carried.from', { date: formatShortDate(fromDateKey(session.date), locale) })}
      </AppText>
      {session.behind.trim() ? (
        <AppText variant="small">
          <AppText variant="smallStrong">{`${t('op.session.behind')}: `}</AppText>
          {session.behind.trim()}
        </AppText>
      ) : null}
      {session.tomorrow.trim() ? (
        <AppText variant="small">
          <AppText variant="smallStrong">{`${t('op.session.tomorrow')}: `}</AppText>
          {session.tomorrow.trim()}
        </AppText>
      ) : null}
    </View>
  );
}

function Form({ date, session, topics, onClose }: { date: string; session: OpSession | null; topics: OpTopic[]; onClose: () => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { spacing } = useTheme();
  const dialog = useDialog();
  const save = useSaveSession();
  const remove = useRemoveSession();
  const carried = useCarriedNotes(date);
  const [topicIds, setTopicIds] = useState(session?.topicIds ?? []);
  const [doneIds, setDoneIds] = useState(session?.doneTopicIds ?? []);
  const [hoursText, setHoursText] = useState(
    session?.hours ? new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(session.hours) : '',
  );
  const [behind, setBehind] = useState(session?.behind ?? '');
  const [tomorrow, setTomorrow] = useState(session?.tomorrow ?? '');
  const [notes, setNotes] = useState(session?.notes ?? '');
  const hours = parseStudyHours(hoursText);
  const planned = topics.filter((x) => topicIds.includes(x.id));
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const onSave = () => {
    if (hours === undefined) return;
    save.mutate(
      {
        id: session?.id ?? null,
        date,
        patch: { topicIds, doneTopicIds: doneIds.filter((id) => topicIds.includes(id)), hours, behind, tomorrow, notes },
      },
      { onSuccess: onClose },
    );
  };

  const onDelete = async () => {
    if (!session) return;
    const ok = await dialog.confirm({
      title: t('op.session.deleteTitle'),
      message: t('op.session.deleteMessage', { date: formatLongDate(fromDateKey(date), locale) }),
      confirmLabel: t('common.delete'),
      destructive: true,
    });
    if (ok) remove.mutate(session.id, { onSuccess: onClose });
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={formatLongDate(fromDateKey(date), locale)}
      subtitle={session ? t('op.session.subtitle') : t('op.session.newSubtitle')}
      footer={
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, flexWrap: 'wrap' }}>
          {session ? (
            <Button label={t('common.delete')} icon="trash-2" variant="ghost" onPress={() => void onDelete()} loading={remove.isPending} />
          ) : null}
          <Button label={t('common.cancel')} variant="secondary" onPress={onClose} />
          <Button label={t('common.save')} icon="check" onPress={onSave} disabled={hours === undefined} loading={save.isPending} />
        </View>
      }
    >
      {carried.data && carried.data.id !== session?.id ? <CarriedNotes session={carried.data} /> : null}

      <View style={{ gap: spacing.sm }}>
        <AppText variant="smallStrong">{t('op.session.topics')}</AppText>
        {topics.length ? (
          <ChipGroup
            multi
            compact
            color={opMeta.accent}
            accessibilityLabel={t('op.session.topics')}
            options={topics.map((x) => ({ value: x.id, label: topicLabel(x, t) }))}
            selected={topicIds}
            onToggle={(id) => setTopicIds((l) => toggle(l, id))}
          />
        ) : (
          <AppText variant="small" tone="textMuted">
            {t('op.session.noTopics')}
          </AppText>
        )}
      </View>

      {planned.length ? (
        <View style={{ gap: spacing.xs }}>
          <AppText variant="smallStrong">{t('op.session.done')}</AppText>
          {planned.map((x) => (
            <Checkbox
              key={x.id}
              checked={doneIds.includes(x.id)}
              onChange={() => setDoneIds((l) => toggle(l, x.id))}
              label={topicLabel(x, t)}
              color={opMeta.accent}
            />
          ))}
        </View>
      ) : null}

      <TextField
        label={t('op.session.hours')}
        hint={t('op.session.hoursHint')}
        value={hoursText}
        onChangeText={setHoursText}
        keyboardType="decimal-pad"
        error={hours === undefined ? t('op.session.hoursInvalid') : undefined}
      />
      <TextField
        label={t('op.session.behind')}
        value={behind}
        onChangeText={setBehind}
        placeholder={t('op.session.behindPlaceholder')}
        multiline
        numberOfLines={3}
      />
      <TextField
        label={t('op.session.tomorrow')}
        value={tomorrow}
        onChangeText={setTomorrow}
        placeholder={t('op.session.tomorrowPlaceholder')}
        multiline
        numberOfLines={3}
      />
      <TextField
        label={t('op.session.notes')}
        value={notes}
        onChangeText={setNotes}
        placeholder={t('op.session.notesPlaceholder')}
        multiline
        numberOfLines={4}
      />
    </Sheet>
  );
}

/** One study day: topics (and which got done), hours and notes. */
export function OpSessionSheet({
  date,
  session,
  topics,
  onClose,
}: {
  date: string | null;
  session: OpSession | null;
  topics: OpTopic[];
  onClose: () => void;
}) {
  if (!date) return null;
  // Keyed so the form starts again from the saved values for every day opened.
  return <Form key={`${date}:${session?.id ?? 'new'}`} date={date} session={session} topics={topics} onClose={onClose} />;
}
