import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useDialog } from '@/components/feedback/DialogProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Divider } from '@/components/ui/Divider';
import { InfoNote } from '@/components/ui/InfoNote';
import { ListRow } from '@/components/ui/ListRow';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { TextField } from '@/components/ui/TextField';
import { useLocale } from '@/hooks/useLocale';
import { useServices } from '@/services/ServicesProvider';
import { useTheme } from '@/theme';
import { formatBytes } from '@/utils/format';
import { Breadcrumb } from './components/Breadcrumb';
import { DocumentRow } from './components/DocumentRow';
import { FolderRow } from './components/FolderRow';
import { ImportSourceSheet } from './components/ImportSourceSheet';
import { MoveSheet } from './components/MoveSheet';
import { StorageBadge } from './components/StorageBadge';
import { supportedExtensions } from './fileTypes';
import {
  useBreadcrumb,
  useCreateFolder,
  useDeleteDocuments,
  useDeleteFolders,
  useFolderContents,
  useRenameDocument,
  useRenameFolder,
  useSecondBrainSearch,
  useStorageStats,
} from './hooks';
import { secondBrainMeta } from './meta';
import { canPickPhotos } from './pickers';
import { useImporter } from './useImporter';

/** Selection keys: "f:<folderId>" / "d:<documentId>". */
const split = (keys: Set<string>) => ({
  folderIds: [...keys].filter((k) => k.startsWith('f:')).map((k) => k.slice(2)),
  documentIds: [...keys].filter((k) => k.startsWith('d:')).map((k) => k.slice(2)),
});

export function SecondBrainScreen() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { spacing } = useTheme();
  const dialog = useDialog();
  const services = useServices();
  const params = useLocalSearchParams<{ folder?: string }>();
  const folderId = typeof params.folder === 'string' && params.folder ? params.folder : null;

  const [query, setQuery] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importMenu, setImportMenu] = useState(false);
  const [moveItems, setMoveItems] = useState<{ folderIds: string[]; documentIds: string[] } | null>(null);

  const contents = useFolderContents(folderId);
  const breadcrumb = useBreadcrumb(folderId);
  const search = useSecondBrainSearch(query);
  const stats = useStorageStats();
  const createFolder = useCreateFolder();
  const renameFolder = useRenameFolder();
  const renameDocument = useRenameDocument();
  const deleteFolders = useDeleteFolders();
  const deleteDocuments = useDeleteDocuments();
  const importer = useImporter(folderId);

  const clearSelection = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  const openFolder = (id: string | null) => {
    clearSelection();
    setQuery('');
    router.setParams({ folder: id ?? '' });
  };

  const openDocument = (id: string) => router.push({ pathname: '/second-brain/document/[id]', params: { id } });

  const onImport = () => (canPickPhotos ? setImportMenu(true) : void importer.pickFiles());

  const onCreate = async () => {
    const name = await dialog.prompt({
      title: t('secondBrain.newFolder'),
      label: t('secondBrain.folderName'),
      confirmLabel: t('common.create'),
    });
    if (name) createFolder.mutate({ name, parentId: folderId });
  };

  const onRename = async (kind: 'folder' | 'document', id: string, current: string) => {
    const name = await dialog.prompt({
      title: t('secondBrain.rename'),
      label: kind === 'folder' ? t('secondBrain.folderName') : t('secondBrain.documentName'),
      initialValue: current,
      confirmLabel: t('common.save'),
    });
    if (!name || name === current) return;
    if (kind === 'folder') renameFolder.mutate({ id, name });
    else renameDocument.mutate({ id, name });
  };

  const onDelete = async (items: { folderIds: string[]; documentIds: string[] }) => {
    const { folderIds, documentIds } = items;
    if (!folderIds.length && !documentIds.length) return;
    const impact = folderIds.length ? await services.secondBrain.deletionImpact(folderIds) : { folders: 0, documents: 0 };
    const total = folderIds.length + documentIds.length;
    const ok = await dialog.confirm({
      title: t('secondBrain.deleteItemsTitle', { count: total }),
      message: t('secondBrain.deleteItemsMessage', { folders: impact.folders, documents: impact.documents + documentIds.length }),
      confirmLabel: t('common.delete'),
      destructive: true,
    });
    if (!ok) return;
    if (documentIds.length) deleteDocuments.mutate(documentIds, { onSuccess: clearSelection });
    if (folderIds.length) deleteFolders.mutate(folderIds, { onSuccess: clearSelection });
  };

  const toggleSelect = (key: string) => {
    setSelecting(true);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const folders = contents.data?.folders ?? [];
  const documents = contents.data?.documents ?? [];
  const allKeys = [...folders.map((f) => `f:${f.id}`), ...documents.map((d) => `d:${d.id}`)];
  const isEmpty = !!contents.data && allKeys.length === 0;
  const currentName = breadcrumb.data?.[breadcrumb.data.length - 1]?.name;

  const selectionBar = selecting ? (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' }}>
      <AppText variant="smallStrong" tone="textMuted">
        {t('secondBrain.selected', { count: selected.size })}
      </AppText>
      <Button
        label={selected.size === allKeys.length ? t('secondBrain.selectNone') : t('secondBrain.selectAll')}
        size="sm"
        variant="ghost"
        onPress={() => setSelected(selected.size === allKeys.length ? new Set() : new Set(allKeys))}
      />
      <Button
        label={t('secondBrain.move.action')}
        size="sm"
        variant="secondary"
        icon="corner-down-right"
        disabled={!selected.size}
        onPress={() => setMoveItems(split(selected))}
      />
      <Button
        label={t('common.delete')}
        size="sm"
        variant="danger"
        icon="trash-2"
        disabled={!selected.size}
        onPress={() => void onDelete(split(selected))}
      />
      <Button label={t('common.cancel')} size="sm" variant="ghost" onPress={clearSelection} />
    </View>
  ) : allKeys.length ? (
    <Button label={t('secondBrain.select')} size="sm" variant="ghost" icon="check-square" onPress={() => setSelecting(true)} />
  ) : null;

  return (
    <Screen>
      <PageHeader
        title={t('modules.secondBrain.title')}
        subtitle={t('secondBrain.subtitle')}
        icon={secondBrainMeta.icon}
        accent={secondBrainMeta.accent}
        actions={
          <>
            <Button label={t('secondBrain.newFolder')} variant="secondary" icon="folder-plus" onPress={() => void onCreate()} />
            <Button label={t('secondBrain.import.action')} icon="upload" onPress={onImport} loading={importer.importing} />
          </>
        }
      />

      <TextField
        leftIcon="search"
        placeholder={t('secondBrain.searchPlaceholder')}
        value={query}
        onChangeText={setQuery}
        returnKeyType="search"
        accessibilityLabel={t('secondBrain.searchPlaceholder')}
      />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
        <StorageBadge />
        {stats.data ? (
          <AppText variant="small" tone="textSubtle">
            {t('secondBrain.stats', { count: stats.data.documents, size: formatBytes(stats.data.bytes, locale) })}
          </AppText>
        ) : null}
      </View>

      {query.trim() ? (
        <Card padded={false} style={{ padding: spacing.sm }}>
          <AppText variant="overline" tone="textMuted" style={{ padding: spacing.md }}>
            {t('secondBrain.results', { count: search.data?.length ?? 0 })}
          </AppText>
          {search.isLoading ? (
            <LoadingState />
          ) : !search.data?.length ? (
            <EmptyState compact icon="search" accent={secondBrainMeta.accent} title={t('secondBrain.noResults', { query: query.trim() })} />
          ) : (
            search.data.map((r) => (
              <ListRow
                key={`${r.ref.type}:${r.ref.id}`}
                icon={r.ref.type === 'folder' ? 'folder' : 'file-text'}
                accent={r.ref.type === 'folder' ? secondBrainMeta.folderColor : secondBrainMeta.accent}
                title={r.title}
                subtitle={[r.kindKey ? t(r.kindKey) : null, r.subtitle ?? t('modules.secondBrain.title')].filter(Boolean).join(' · ')}
                chevron
                onPress={() => (r.ref.type === 'folder' ? openFolder(r.ref.id) : openDocument(r.ref.id))}
              />
            ))
          )}
        </Card>
      ) : (
        <Card padded={false} style={{ padding: spacing.sm }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md, padding: spacing.md }}>
            <View style={{ flex: 1, minWidth: 160 }}>
              <Breadcrumb path={breadcrumb.data ?? []} onNavigate={openFolder} />
            </View>
            {selectionBar}
          </View>
          <Divider />
          {contents.isLoading ? (
            <LoadingState />
          ) : contents.isError ? (
            <ErrorState onRetry={() => void contents.refetch()} />
          ) : isEmpty ? (
            <EmptyState
              icon={folderId ? 'folder' : 'book-open'}
              accent={secondBrainMeta.accent}
              title={folderId ? t('secondBrain.emptyFolder', { name: currentName ?? '' }) : t('secondBrain.emptyRoot')}
              description={folderId ? t('secondBrain.emptyFolderDescription') : t('secondBrain.emptyRootDescription')}
              actionLabel={t('secondBrain.import.action')}
              onAction={onImport}
              secondary={
                <Button
                  label={t('secondBrain.newFolder')}
                  variant="ghost"
                  icon="folder-plus"
                  onPress={() => void onCreate()}
                  style={{ alignSelf: 'center' }}
                />
              }
            />
          ) : (
            <View style={{ paddingVertical: spacing.xs }}>
              {folders.map((f) => (
                <FolderRow
                  key={f.id}
                  folder={f}
                  selecting={selecting}
                  selected={selected.has(`f:${f.id}`)}
                  onOpen={() => router.push({ pathname: '/second-brain', params: { folder: f.id } })}
                  onToggleSelect={() => toggleSelect(`f:${f.id}`)}
                  onRename={() => void onRename('folder', f.id, f.name)}
                  onDelete={() => void onDelete({ folderIds: [f.id], documentIds: [] })}
                />
              ))}
              {folders.length && documents.length ? <Divider vertical={4} /> : null}
              {documents.map((d) => (
                <DocumentRow
                  key={d.id}
                  doc={d}
                  selecting={selecting}
                  selected={selected.has(`d:${d.id}`)}
                  onOpen={() => openDocument(d.id)}
                  onToggleSelect={() => toggleSelect(`d:${d.id}`)}
                  onRename={() => void onRename('document', d.id, d.name)}
                  onDelete={() => void onDelete({ folderIds: [], documentIds: [d.id] })}
                />
              ))}
            </View>
          )}
        </Card>
      )}

      <InfoNote
        title={t('secondBrain.formats.title')}
        description={t('secondBrain.formats.description', { formats: supportedExtensions.map((e) => e.toUpperCase()).join(', ') })}
        items={[t('secondBrain.formats.viewer'), t('secondBrain.formats.next')]}
      />

      <ImportSourceSheet
        visible={importMenu}
        onClose={() => setImportMenu(false)}
        onFiles={() => void importer.pickFiles()}
        onPhotos={() => void importer.pickPhotos()}
      />
      <MoveSheet
        visible={!!moveItems}
        onClose={() => setMoveItems(null)}
        onMoved={clearSelection}
        folderIds={moveItems?.folderIds ?? []}
        documentIds={moveItems?.documentIds ?? []}
        currentFolderId={folderId}
      />
    </Screen>
  );
}
