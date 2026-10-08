import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { interaction } from '@/components/ui/interaction';
import { hitSize, useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';
import { secondBrainMeta } from '../meta';
import type { Folder } from '../types';

interface Props {
  folder: Folder & { childCount: number };
  selecting: boolean;
  selected: boolean;
  onOpen: () => void;
  onToggleSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
}

export function FolderRow({ folder, selecting, selected, onOpen, onToggleSelect, onRename, onDelete }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const color = folder.color ?? secondBrainMeta.folderColor;
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
        accessibilityLabel={`${folder.name}, ${t('secondBrain.items', { count: folder.childCount })}`}
        accessibilityHint={selecting ? undefined : t('secondBrain.openFolderHint')}
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
            backgroundColor: withAlpha(color, 0.14),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="folder" size={19} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {folder.name}
          </AppText>
          <AppText variant="small" tone="textMuted">
            {t('secondBrain.items', { count: folder.childCount })}
          </AppText>
        </View>
        {selecting ? null : <Icon name="chevron-right" size={18} color={colors.textSubtle} />}
      </Pressable>
      {selecting ? null : (
        <View style={{ flexDirection: 'row', paddingRight: spacing.xs }}>
          <IconButton icon="edit-2" size={16} label={`${t('secondBrain.rename')}: ${folder.name}`} onPress={onRename} />
          <IconButton icon="trash-2" size={16} label={`${t('common.delete')}: ${folder.name}`} onPress={onDelete} />
        </View>
      )}
    </View>
  );
}
