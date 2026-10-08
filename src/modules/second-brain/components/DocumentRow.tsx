import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { interaction } from '@/components/ui/interaction';
import { useLocale } from '@/hooks/useLocale';
import { hitSize, useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';
import { formatShortDate } from '@/utils/date';
import { formatBytes } from '@/utils/format';
import { fileTypeFor } from '../fileTypes';
import type { DocumentItem } from '../types';

/** Colour per document family, so lists are scannable at a glance. */
export const DOC_COLORS = { pdf: '#E5484D', image: '#0EA5A4', office: '#2F80ED', external: '#64748B' } as const;

interface Props {
  doc: DocumentItem;
  selecting: boolean;
  selected: boolean;
  onOpen: () => void;
  onToggleSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
}

export function DocumentRow({ doc, selecting, selected, onOpen, onToggleSelect, onRename, onDelete }: Props) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { colors, spacing, radius } = useTheme();
  const type = fileTypeFor(doc.name);
  const color = doc.extension === 'xls' || doc.extension === 'xlsx' ? '#16A34A' : DOC_COLORS[type?.viewer ?? 'external'];
  const meta = `${doc.extension.toUpperCase()} · ${formatBytes(doc.size, locale)} · ${formatShortDate(new Date(doc.createdAt), locale)}`;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: radius.md,
        backgroundColor: selected ? colors.primarySoft : 'transparent',
      }}
    >
      <Pressable
        onPress={selecting ? onToggleSelect : onOpen}
        onLongPress={onToggleSelect}
        accessibilityRole={selecting ? 'checkbox' : 'button'}
        aria-checked={selecting ? selected : undefined}
        accessibilityLabel={`${doc.name}, ${meta}`}
        accessibilityHint={selecting ? undefined : t('secondBrain.openDocumentHint')}
        style={(s) => {
          const { hovered, pressed } = interaction(s);
          return {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            minHeight: hitSize + 12,
            paddingHorizontal: spacing.md,
            borderRadius: radius.md,
            backgroundColor: selected ? 'transparent' : pressed ? colors.surfacePressed : hovered ? colors.surfaceMuted : 'transparent',
          };
        }}
      >
        {selecting ? (
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 5,
              borderWidth: 1.5,
              borderColor: selected ? colors.primary : colors.borderStrong,
              backgroundColor: selected ? colors.primary : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {selected ? <Icon name="check" size={14} color="#FFFFFF" /> : null}
          </View>
        ) : null}
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: radius.md,
            backgroundColor: withAlpha(color, 0.12),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={type?.icon ?? 'file'} size={18} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {doc.name}
          </AppText>
          <AppText variant="small" tone="textMuted" numberOfLines={1}>
            {meta}
          </AppText>
        </View>
      </Pressable>
      {selecting ? null : (
        <View style={{ flexDirection: 'row', paddingRight: spacing.xs }}>
          <IconButton icon="edit-2" size={16} label={`${t('secondBrain.rename')}: ${doc.name}`} onPress={onRename} />
          <IconButton icon="trash-2" size={16} label={`${t('common.delete')}: ${doc.name}`} onPress={onDelete} />
        </View>
      )}
    </View>
  );
}
