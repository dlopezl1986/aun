import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { TextField } from '@/components/ui/TextField';
import { Card, CardHeader } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { StorageBadge } from './components/StorageBadge';
import { useCreateFolder, useFolderContents } from './hooks';
import { canPickPhotos } from './pickers';
import { useImporter } from './useImporter';
import { secondBrainMeta } from './meta';

export function SecondBrainWidget() {
  const { t } = useTranslation();
  const { data, isLoading } = useFolderContents(null);
  return (
    <Card style={{ flex: 1 }}>
      <CardHeader
        title={t('modules.secondBrain.title')}
        icon={secondBrainMeta.icon}
        accent={secondBrainMeta.accent}
        actionLabel={t('common.open')}
        onAction={() => router.navigate('/second-brain')}
      />
      <View style={{ marginBottom: 8 }}>
        <StorageBadge />
      </View>
      {isLoading ? (
        <LoadingState />
      ) : !data?.folders.length ? (
        <EmptyState compact icon="folder" accent={secondBrainMeta.accent} title={t('secondBrain.emptyRoot')} />
      ) : (
        data.folders
          .slice(0, 4)
          .map((f) => (
            <ListRow
              key={f.id}
              icon="folder"
              accent={secondBrainMeta.folderColor}
              title={f.name}
              subtitle={t('secondBrain.items', { count: f.childCount })}
              onPress={() => router.navigate({ pathname: '/second-brain', params: { folder: f.id } })}
            />
          ))
      )}
    </Card>
  );
}

/** Quick action: new top-level folder from Inicio. */
function QuickFolderForm({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const create = useCreateFolder();
  const [name, setName] = useState('');
  const save = () => {
    if (!name.trim()) return;
    create.mutate({ name, parentId: null }, { onSuccess: onClose });
  };
  return (
    <Sheet
      visible
      onClose={onClose}
      title={t('secondBrain.newFolder')}
      subtitle={t('secondBrain.quick.subtitle')}
      footer={
        <>
          <Button label={t('common.cancel')} variant="ghost" onPress={onClose} />
          <Button label={t('common.create')} onPress={save} disabled={!name.trim()} loading={create.isPending} />
        </>
      }
    >
      <TextField
        autoFocus
        label={t('secondBrain.folderName')}
        value={name}
        onChangeText={setName}
        onSubmitEditing={save}
        returnKeyType="done"
      />
    </Sheet>
  );
}

export function QuickFolderSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return visible ? <QuickFolderForm onClose={onClose} /> : null;
}

/** Quick action: import documents into the 2ndBrain root from Inicio. */
function QuickImportForm({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const importer = useImporter(null);
  const pick = (fn: () => Promise<void>) => () => {
    if (canPickPhotos) {
      // iOS/Android present one modal at a time: close the sheet, then open the picker.
      onClose();
      setTimeout(() => void fn(), 350);
    } else {
      // Web: the picker must open inside this click (user activation).
      void fn().then(onClose);
    }
  };
  return (
    <Sheet visible onClose={onClose} title={t('secondBrain.import.title')} subtitle={t('secondBrain.import.quickSubtitle')}>
      <ListRow
        icon="folder"
        accent={secondBrainMeta.accent}
        title={canPickPhotos ? t('secondBrain.import.fromFiles') : t('secondBrain.import.chooseFiles')}
        subtitle={t('secondBrain.import.fromFilesHint')}
        chevron
        onPress={pick(importer.pickFiles)}
      />
      {canPickPhotos ? (
        <ListRow
          icon="image"
          accent="#0EA5A4"
          title={t('secondBrain.import.fromPhotos')}
          subtitle={t('secondBrain.import.fromPhotosHint')}
          chevron
          onPress={pick(importer.pickPhotos)}
        />
      ) : null}
    </Sheet>
  );
}

export function QuickImportSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return visible ? <QuickImportForm onClose={onClose} /> : null;
}
