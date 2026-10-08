import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { LoadingState } from '@/components/ui/States';
import { useTheme } from '@/theme';
import { useAllFolders, useMoveItems } from '../hooks';
import { secondBrainMeta } from '../meta';
import type { Folder } from '../types';

interface Props {
  visible: boolean;
  onClose: () => void;
  onMoved?: () => void;
  folderIds: string[];
  documentIds: string[];
  /** Folder the items currently live in (pre-selected, can't be the target). */
  currentFolderId: string | null;
}

interface Node {
  folder: Folder;
  depth: number;
}

/** Depth-first flattening of the folder tree (sorted by name). */
function flatten(folders: Folder[]): Node[] {
  const children = new Map<string | null, Folder[]>();
  for (const f of folders) children.set(f.parentId, [...(children.get(f.parentId) ?? []), f]);
  const out: Node[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const f of (children.get(parent) ?? []).sort((a, b) => a.name.localeCompare(b.name))) {
      out.push({ folder: f, depth });
      walk(f.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

function MoveForm({ onClose, onMoved, folderIds, documentIds, currentFolderId }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const folders = useAllFolders();
  const move = useMoveItems();
  const [target, setTarget] = useState<string | null>(currentFolderId);

  const nodes = useMemo(() => flatten(folders.data ?? []), [folders.data]);
  // A folder can't be moved into itself or any of its descendants.
  const blocked = useMemo(() => {
    const set = new Set(folderIds);
    for (const n of nodes) if (n.folder.parentId && set.has(n.folder.parentId)) set.add(n.folder.id);
    return set;
  }, [nodes, folderIds]);

  const count = folderIds.length + documentIds.length;
  const save = () =>
    move.mutate(
      { folderIds, documentIds, target },
      {
        onSuccess: () => {
          onMoved?.();
          onClose();
        },
      },
    );

  const option = (id: string | null, name: string, depth: number, disabled: boolean) => {
    const active = target === id;
    return (
      <Pressable
        key={id ?? 'root'}
        onPress={() => setTarget(id)}
        disabled={disabled}
        accessibilityRole="radio"
        aria-checked={active}
        aria-disabled={disabled}
        accessibilityLabel={name}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          minHeight: 44,
          paddingLeft: spacing.md + depth * 18,
          paddingRight: spacing.md,
          borderRadius: radius.md,
          backgroundColor: active ? colors.primarySoft : 'transparent',
          opacity: disabled ? 0.4 : 1,
        }}
      >
        <Icon name={id ? 'folder' : 'home'} size={17} color={id ? secondBrainMeta.folderColor : colors.primary} />
        <AppText variant={active ? 'bodyStrong' : 'body'} tone={active ? 'primary' : 'text'} numberOfLines={1} style={{ flex: 1 }}>
          {name}
        </AppText>
        {active ? <Icon name="check" size={16} color={colors.primary} /> : null}
      </Pressable>
    );
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={t('secondBrain.move.title', { count })}
      subtitle={t('secondBrain.move.subtitle')}
      footer={
        <>
          <Button label={t('common.cancel')} variant="ghost" onPress={onClose} />
          <Button
            label={t('secondBrain.move.confirm')}
            icon="corner-down-right"
            onPress={save}
            disabled={target === currentFolderId}
            loading={move.isPending}
          />
        </>
      }
    >
      {folders.isLoading ? (
        <LoadingState />
      ) : (
        <View accessibilityRole="radiogroup">
          {option(null, t('secondBrain.move.root'), 0, false)}
          {nodes.map((n) => option(n.folder.id, n.folder.name, n.depth + 1, blocked.has(n.folder.id)))}
        </View>
      )}
    </Sheet>
  );
}

export function MoveSheet(props: Props) {
  return props.visible ? <MoveForm {...props} /> : null;
}
