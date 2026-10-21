import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useTheme } from '@/theme';
import { useAddTopics } from '../hooks';
import { TileLegend, TopicGrid } from './TopicGrid';

const MAX_TOPICS = 300;

/**
 * Builds the syllabus in two steps: how many topics it has, then tap the
 * ones you will not study to leave them out. Numbers you already have stay.
 */
export function SyllabusSetup({ existing, onDone }: { existing: number[]; onDone?: () => void }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const add = useAddTopics();
  const have = new Set(existing);
  const [countText, setCountText] = useState(existing.length ? String(Math.max(...existing)) : '');
  const [off, setOff] = useState<Set<number>>(new Set());
  const n = Number(countText.trim());
  const count = Number.isInteger(n) && n > 0 && n <= MAX_TOPICS ? n : 0;
  const numbers = Array.from({ length: count }, (_, i) => i + 1);
  const toAdd = numbers.filter((x) => !have.has(x) && !off.has(x));

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ maxWidth: 260 }}>
        <TextField
          label={t('op.setup.count')}
          value={countText}
          onChangeText={(v) => setCountText(v.replace(/[^0-9]/g, ''))}
          placeholder="45"
          keyboardType="number-pad"
          error={countText && !count ? t('op.setup.countInvalid', { max: MAX_TOPICS }) : undefined}
        />
      </View>
      {count ? (
        <>
          <AppText variant="small" tone="textMuted">
            {t('op.setup.tapToSkip')}
          </AppText>
          <TopicGrid
            size={40}
            tiles={numbers.map((x) => ({
              key: String(x),
              number: x,
              state: have.has(x) ? 'studied' : off.has(x) ? 'off' : 'chosen',
              label: have.has(x)
                ? t('op.setup.alreadyThere', { number: x })
                : off.has(x)
                  ? t('op.setup.skipped', { number: x })
                  : t('op.syllabus.topic', { number: x }),
            }))}
            onPress={({ number }) => {
              if (have.has(number)) return;
              setOff((prev) => {
                const next = new Set(prev);
                if (next.has(number)) next.delete(number);
                else next.add(number);
                return next;
              });
            }}
          />
          <TileLegend
            states={have.size ? ['chosen', 'off', 'studied'] : ['chosen', 'off']}
            labels={{ chosen: t('op.setup.legendAdd'), off: t('op.setup.legendSkip'), studied: t('op.setup.legendHave') }}
          />
        </>
      ) : null}
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Button
          label={t('op.setup.create', { count: toAdd.length })}
          icon="check"
          disabled={!toAdd.length}
          loading={add.isPending}
          onPress={() =>
            add.mutate(toAdd, {
              onSuccess: () => {
                setOff(new Set());
                onDone?.();
              },
            })
          }
        />
        {onDone ? <Button label={t('common.cancel')} variant="ghost" onPress={onDone} /> : null}
      </View>
    </View>
  );
}
