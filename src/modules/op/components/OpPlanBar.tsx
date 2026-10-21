import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ChipGroup } from '@/components/forms/Chips';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';
import { opMeta } from '../meta';
import type { OpTopic } from '../types';

/**
 * Plan mode: pick one or more topics, then tap days on the month to put them
 * there (tap a day again to take them off). Every tap is saved at once.
 */
export function OpPlanBar({
  topics,
  selected,
  onToggle,
  onDone,
}: {
  topics: OpTopic[];
  selected: string[];
  onToggle: (id: string) => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const { spacing, colors, radius } = useTheme();
  return (
    <View
      style={{
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: withAlpha(opMeta.accent, 0.4),
        backgroundColor: withAlpha(opMeta.accent, 0.06),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name="edit-3" size={16} color={opMeta.accent} />
        <AppText variant="smallStrong" style={{ flex: 1 }}>
          {selected.length ? t('op.plan.hintTap') : t('op.plan.hintPick')}
        </AppText>
        <Button label={t('op.plan.done')} icon="check" size="sm" onPress={onDone} />
      </View>
      {topics.length ? (
        <ChipGroup
          multi
          compact
          color={opMeta.accent}
          accessibilityLabel={t('op.plan.topics')}
          options={topics.map((x) => ({ value: x.id, label: `T${x.number}` }))}
          selected={selected}
          onToggle={onToggle}
        />
      ) : (
        <AppText variant="small" tone="textMuted">
          {t('op.plan.noTopics')}
        </AppText>
      )}
      <AppText variant="caption" color={colors.textMuted}>
        {t('op.plan.note')}
      </AppText>
    </View>
  );
}
