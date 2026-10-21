import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useDialog } from '@/components/feedback/DialogProvider';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { IconButton } from '@/components/ui/IconButton';
import { TextField } from '@/components/ui/TextField';
import { useLocale } from '@/hooks/useLocale';
import { useTheme } from '@/theme';
import { formatHours } from '@/modules/calendars/shiftHours';
import { useAddTopic, useAddTopicRange, useRemoveTopic, useUpdateTopic } from '../hooks';
import { opMeta } from '../meta';
import type { OpTopic } from '../types';
import { topicLabel } from './topicLabel';

const parseNumber = (text: string) => {
  const n = Number(text.trim());
  return text.trim() && Number.isInteger(n) && n > 0 && n <= 999 ? n : null;
};

function EditRow({ topic, onDone }: { topic: OpTopic; onDone: () => void }) {
  const { t } = useTranslation();
  const { spacing, colors, radius } = useTheme();
  const update = useUpdateTopic();
  const [number, setNumber] = useState(String(topic.number));
  const [title, setTitle] = useState(topic.title);
  const n = parseNumber(number);
  return (
    <View style={{ gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceMuted }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ width: 90 }}>
          <TextField label={t('op.syllabus.number')} value={number} onChangeText={setNumber} keyboardType="number-pad" compact />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            label={t('op.syllabus.title')}
            value={title}
            onChangeText={setTitle}
            placeholder={t('op.syllabus.titlePlaceholder')}
            autoFocus
            compact
          />
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm }}>
        <Button label={t('common.cancel')} variant="ghost" size="sm" onPress={onDone} />
        <Button
          label={t('common.save')}
          icon="check"
          size="sm"
          disabled={!n}
          loading={update.isPending}
          onPress={() => n && update.mutate({ id: topic.id, patch: { number: n, title } }, { onSuccess: onDone })}
        />
      </View>
    </View>
  );
}

/** The syllabus: topics with a "studied" check and the hours spent on each (approximate). */
export function OpSyllabus({ topics, hoursByTopic }: { topics: OpTopic[]; hoursByTopic: Map<string, number> }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { spacing } = useTheme();
  const dialog = useDialog();
  const update = useUpdateTopic();
  const remove = useRemoveTopic();
  const add = useAddTopic();
  const addRange = useAddTopicRange();
  const [editing, setEditing] = useState<string | null>(null);
  const nextNumber = topics.reduce((max, x) => Math.max(max, x.number), 0) + 1;
  const [newNumber, setNewNumber] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const n = parseNumber(newNumber || String(nextNumber));
  const to = parseNumber(rangeTo);

  return (
    <View style={{ gap: spacing.md }}>
      {topics.length ? (
        <View style={{ gap: 2 }}>
          {topics.map((x) =>
            editing === x.id ? (
              <EditRow key={x.id} topic={x} onDone={() => setEditing(null)} />
            ) : (
              <Checkbox
                key={x.id}
                checked={x.studied}
                onChange={(studied) => update.mutate({ id: x.id, patch: { studied } })}
                label={topicLabel(x, t)}
                description={
                  hoursByTopic.get(x.id) ? t('op.syllabus.hours', { hours: formatHours(hoursByTopic.get(x.id) ?? 0, locale) }) : undefined
                }
                color={opMeta.accent}
                right={
                  <View style={{ flexDirection: 'row' }}>
                    <IconButton
                      icon="edit-2"
                      size={16}
                      label={`${t('common.edit')}: ${topicLabel(x, t)}`}
                      onPress={() => setEditing(x.id)}
                    />
                    <IconButton
                      icon="trash-2"
                      size={16}
                      label={`${t('common.delete')}: ${topicLabel(x, t)}`}
                      onPress={async () => {
                        const ok = await dialog.confirm({
                          title: t('op.syllabus.deleteTitle', { name: topicLabel(x, t) }),
                          message: t('op.syllabus.deleteMessage'),
                          confirmLabel: t('common.delete'),
                          destructive: true,
                        });
                        if (ok) remove.mutate(x.id);
                      }}
                    />
                  </View>
                }
              />
            ),
          )}
        </View>
      ) : (
        <AppText variant="small" tone="textMuted">
          {t('op.syllabus.empty')}
        </AppText>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, flexWrap: 'wrap' }}>
        <View style={{ width: 80 }}>
          <TextField
            label={t('op.syllabus.number')}
            value={newNumber}
            onChangeText={setNewNumber}
            placeholder={String(nextNumber)}
            keyboardType="number-pad"
            compact
          />
        </View>
        <View style={{ flex: 1, minWidth: 160 }}>
          <TextField
            label={t('op.syllabus.title')}
            value={newTitle}
            onChangeText={setNewTitle}
            placeholder={t('op.syllabus.titlePlaceholder')}
            compact
          />
        </View>
        <Button
          label={t('op.syllabus.add')}
          icon="plus"
          variant="secondary"
          disabled={!n}
          loading={add.isPending}
          onPress={() =>
            n &&
            add.mutate(
              { number: n, title: newTitle },
              {
                onSuccess: () => {
                  setNewNumber('');
                  setNewTitle('');
                },
              },
            )
          }
        />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, flexWrap: 'wrap' }}>
        <View style={{ flex: 1, minWidth: 160 }}>
          <TextField
            label={t('op.syllabus.rangeLabel')}
            hint={t('op.syllabus.rangeHint')}
            value={rangeTo}
            onChangeText={setRangeTo}
            placeholder="60"
            keyboardType="number-pad"
            compact
          />
        </View>
        <Button
          label={t('op.syllabus.rangeButton', { count: to ?? 0 })}
          icon="layers"
          variant="secondary"
          disabled={!to}
          loading={addRange.isPending}
          onPress={() => to && addRange.mutate({ from: 1, to }, { onSuccess: () => setRangeTo('') })}
        />
      </View>
    </View>
  );
}
