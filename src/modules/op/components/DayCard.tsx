import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { interaction } from '@/components/ui/interaction';
import { Sheet } from '@/components/ui/Sheet';
import { TextField } from '@/components/ui/TextField';
import { useLocale } from '@/hooks/useLocale';
import { formatHours } from '@/modules/calendars/shiftHours';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';
import { formatLongDate, formatShortDate, fromDateKey } from '@/utils/date';
import { useCarriedNotes, useSetDay } from '../hooks';
import { opMeta } from '../meta';
import type { SessionPatch } from '../service';
import type { OpSession, OpTopic } from '../types';
import { topicLabel } from './topicLabel';
import { TopicGrid } from './TopicGrid';

const HOURS_STEP = 0.5;
const SAVE_DELAY_MS = 700;

/** A text that saves itself a moment after you stop typing (and when the day is left). */
function useAutosave(saved: string, save: (v: string) => void) {
  const [value, setValue] = useState(saved);
  const pending = useRef<string | null>(null);
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    if (pending.current === null) return;
    const id = setTimeout(() => {
      if (pending.current === null) return;
      saveRef.current(pending.current);
      pending.current = null;
    }, SAVE_DELAY_MS);
    return () => clearTimeout(id);
  }, [value]);
  useEffect(
    () => () => {
      if (pending.current !== null) saveRef.current(pending.current);
    },
    [],
  );
  const change = (v: string) => {
    pending.current = v;
    setValue(v);
  };
  return [value, change] as const;
}

/** What the previous study day left for this one. */
function Carried({ session }: { session: OpSession }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { spacing, colors, radius } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: radius.md,
        backgroundColor: colors.warningSoft,
      }}
    >
      <Icon name="corner-down-right" size={16} color={colors.warning} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="smallStrong" color={colors.warning}>
          {t('op.carried.from', { date: formatShortDate(fromDateKey(session.date), locale) })}
        </AppText>
        {session.behind.trim() ? (
          <AppText variant="small">
            <AppText variant="smallStrong">{`${t('op.day.behind')}: `}</AppText>
            {session.behind.trim()}
          </AppText>
        ) : null}
        {session.tomorrow.trim() ? (
          <AppText variant="small">
            <AppText variant="smallStrong">{`${t('op.day.tomorrow')}: `}</AppText>
            {session.tomorrow.trim()}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

/** Pick the topics of a day on the numbered grid (each tap is saved). */
export function TopicPickerSheet({
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
  const { t } = useTranslation();
  const locale = useLocale();
  const { spacing } = useTheme();
  const setDay = useSetDay();
  if (!date) return null;
  const chosen = session?.topicIds ?? [];
  const toggle = (id: string) => {
    const next = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id];
    setDay.mutate({ date, patch: { topicIds: next, doneTopicIds: (session?.doneTopicIds ?? []).filter((x) => next.includes(x)) } });
  };
  const picked = topics.filter((x) => chosen.includes(x.id));
  return (
    <Sheet
      visible
      onClose={onClose}
      title={t('op.picker.title')}
      subtitle={t('op.picker.subtitle', { date: formatLongDate(fromDateKey(date), locale) })}
      footer={
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <Button label={t('op.picker.done')} icon="check" onPress={onClose} />
        </View>
      }
    >
      <TopicGrid
        tiles={topics.map((x) => ({
          key: x.id,
          number: x.number,
          state: chosen.includes(x.id) ? 'chosen' : x.studied ? 'studied' : 'idle',
          label: topicLabel(x, t),
        }))}
        onPress={(tile) => toggle(tile.key)}
      />
      <View style={{ gap: spacing.xs }}>
        {picked.length ? (
          picked.map((x) => (
            <AppText key={x.id} variant="small">
              {`• ${topicLabel(x, t)}`}
            </AppText>
          ))
        ) : (
          <AppText variant="small" tone="textMuted">
            {t('op.picker.none')}
          </AppText>
        )}
      </View>
    </Sheet>
  );
}

/** One topic of the day: tap to mark it done, × to take it off the day. */
function DayTopic({ topic, done, onToggle, onRemove }: { topic: OpTopic; done: boolean; onToggle: () => void; onRemove: () => void }) {
  const { t } = useTranslation();
  const { spacing, colors, radius } = useTheme();
  const accent = opMeta.accent;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: radius.md,
        backgroundColor: done ? withAlpha(accent, 0.1) : colors.surfaceMuted,
      }}
    >
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        aria-checked={done}
        accessibilityLabel={topicLabel(topic, t)}
        style={(s) => ({
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          opacity: interaction(s).pressed ? 0.7 : 1,
        })}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: done ? 0 : 2,
            borderColor: withAlpha(accent, 0.5),
            backgroundColor: done ? accent : 'transparent',
          }}
        >
          {done ? <Icon name="check" size={14} color="#FFFFFF" /> : null}
        </View>
        <AppText
          variant="body"
          style={{ flex: 1, textDecorationLine: done ? 'line-through' : 'none' }}
          tone={done ? 'textMuted' : 'text'}
          numberOfLines={1}
        >
          {topicLabel(topic, t)}
        </AppText>
      </Pressable>
      <IconButton icon="x" size={16} label={`${t('op.day.removeTopic')}: ${topicLabel(topic, t)}`} onPress={onRemove} />
    </View>
  );
}

function HoursStepper({ hours, onChange }: { hours: number; onChange: (h: number) => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { spacing, colors, radius } = useTheme();
  const accent = opMeta.accent;
  const step = (dir: 1 | -1) => onChange(Math.min(24, Math.max(0, Math.round((hours + dir * HOURS_STEP) * 2) / 2)));
  const btn = (dir: 1 | -1) => (
    <Pressable
      onPress={() => step(dir)}
      disabled={dir < 0 ? hours <= 0 : hours >= 24}
      accessibilityRole="button"
      accessibilityLabel={dir > 0 ? t('op.day.moreHours') : t('op.day.lessHours')}
      style={(s) => ({
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: interaction(s).hovered ? withAlpha(accent, 0.18) : withAlpha(accent, 0.1),
        opacity: (dir < 0 ? hours <= 0 : hours >= 24) ? 0.4 : 1,
      })}
    >
      <Icon name={dir > 0 ? 'plus' : 'minus'} size={18} color={accent} />
    </Pressable>
  );
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        padding: spacing.sm,
        paddingLeft: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: colors.surfaceMuted,
      }}
    >
      <AppText variant="bodyStrong" style={{ flex: 1 }}>
        {t('op.day.hours')}
      </AppText>
      {btn(-1)}
      <AppText variant="heading" color={accent} style={{ minWidth: 56, textAlign: 'center' }} accessibilityLiveRegion="polite">
        {formatHours(hours, locale)}
      </AppText>
      {btn(1)}
    </View>
  );
}

/** The selected day: what is left from before, its topics, hours and notes. Everything saves itself. */
export function DayCard({
  date,
  today,
  session,
  topics,
  onPickTopics,
}: {
  date: string;
  today: string;
  session: OpSession | null;
  topics: OpTopic[];
  onPickTopics: () => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { spacing } = useTheme();
  const setDay = useSetDay();
  const carried = useCarriedNotes(date);
  const save = (patch: SessionPatch) => setDay.mutate({ date, patch });
  const [hours, setHours] = useState(session?.hours ?? 0);
  const [behind, setBehind] = useAutosave(session?.behind ?? '', (behind) => save({ behind }));
  const [tomorrow, setTomorrow] = useAutosave(session?.tomorrow ?? '', (tomorrow) => save({ tomorrow }));
  const [notes, setNotes] = useAutosave(session?.notes ?? '', (notes) => save({ notes }));
  const dayTopics = topics.filter((x) => session?.topicIds.includes(x.id));
  const done = session?.doneTopicIds ?? [];
  const isToday = date === today;

  return (
    <View style={{ gap: spacing.lg }}>
      <AppText variant="subheading" accessibilityRole="header">
        {isToday ? `${t('common.today')} · ${formatLongDate(fromDateKey(date), locale)}` : formatLongDate(fromDateKey(date), locale)}
      </AppText>

      {carried.data && carried.data.id !== session?.id ? <Carried session={carried.data} /> : null}

      <View style={{ gap: spacing.sm }}>
        {dayTopics.map((x) => (
          <DayTopic
            key={x.id}
            topic={x}
            done={done.includes(x.id)}
            onToggle={() => save({ doneTopicIds: done.includes(x.id) ? done.filter((d) => d !== x.id) : [...done, x.id] })}
            onRemove={() =>
              save({
                topicIds: (session?.topicIds ?? []).filter((d) => d !== x.id),
                doneTopicIds: done.filter((d) => d !== x.id),
              })
            }
          />
        ))}
        {dayTopics.length ? null : (
          <AppText variant="small" tone="textMuted">
            {t('op.day.noTopics')}
          </AppText>
        )}
        <View style={{ flexDirection: 'row' }}>
          <Button
            label={dayTopics.length ? t('op.day.changeTopics') : t('op.day.addTopics')}
            icon="plus"
            variant="secondary"
            size="sm"
            onPress={onPickTopics}
          />
        </View>
      </View>

      <HoursStepper
        hours={hours}
        onChange={(h) => {
          setHours(h);
          save({ hours: h });
        }}
      />

      <TextField
        label={t('op.day.behind')}
        value={behind}
        onChangeText={setBehind}
        placeholder={t('op.day.behindPlaceholder')}
        multiline
        numberOfLines={2}
      />
      <TextField
        label={t('op.day.tomorrow')}
        value={tomorrow}
        onChangeText={setTomorrow}
        placeholder={t('op.day.tomorrowPlaceholder')}
        multiline
        numberOfLines={2}
      />
      <TextField
        label={t('op.day.notes')}
        value={notes}
        onChangeText={setNotes}
        placeholder={t('op.day.notesPlaceholder')}
        multiline
        numberOfLines={3}
      />
      <AppText variant="caption" tone="textMuted">
        {setDay.isPending ? t('op.day.saving') : t('op.day.autosave')}
      </AppText>
    </View>
  );
}
