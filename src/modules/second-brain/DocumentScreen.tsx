import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useDialog } from '@/components/feedback/DialogProvider';
import { useToast } from '@/components/feedback/ToastProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useLocale } from '@/hooks/useLocale';
import { useServices } from '@/services/ServicesProvider';
import { StorageProviderError } from '@/storage/providers/errors';
import { getProviderDescriptor } from '@/storage/providers/descriptors';
import { formatShortDate } from '@/utils/date';
import { formatBytes } from '@/utils/format';
import { DocumentViewer } from './components/DocumentViewer';
import { MoveSheet } from './components/MoveSheet';
import { fileTypeFor } from './fileTypes';
import { useDeleteDocuments, useDocument, useRenameDocument } from './hooks';
import { secondBrainMeta } from './meta';
import { exportFile, exportMode } from './share';

export function DocumentScreen() {
  const { t } = useTranslation();
  const locale = useLocale();
  const toast = useToast();
  const dialog = useDialog();
  const services = useServices();
  const { isCompact } = useBreakpoint();
  const { id } = useLocalSearchParams<{ id: string }>();
  const docQuery = useDocument(id);
  const doc = docQuery.data;
  const rename = useRenameDocument();
  const remove = useDeleteDocuments();
  const [moving, setMoving] = useState(false);

  // Resolve a local URI through the document's storage provider.
  const file = useQuery({
    queryKey: ['u', services.userId, 'folders', 'file', id, doc?.storage.providerFileId],
    queryFn: () => services.secondBrain.openDocument(doc!),
    enabled: !!doc,
    gcTime: 0,
    staleTime: Infinity,
    retry: false,
  });
  const handle = file.data;
  useEffect(() => () => handle?.release?.(), [handle]);

  const back = () => {
    const folder = doc?.folderId;
    if (router.canGoBack()) router.back();
    else router.replace(folder ? { pathname: '/second-brain', params: { folder } } : '/second-brain');
  };

  if (docQuery.isLoading) return <Screen>{<LoadingState />}</Screen>;
  if (!doc) {
    return (
      <Screen>
        <EmptyState
          icon="file"
          accent={secondBrainMeta.accent}
          title={t('secondBrain.viewer.notFound')}
          actionLabel={t('common.back')}
          onAction={back}
        />
      </Screen>
    );
  }

  const type = fileTypeFor(doc.name);
  const provider = getProviderDescriptor(doc.storage.providerId);
  const subtitle = [
    type ? t(type.labelKey) : doc.extension.toUpperCase(),
    formatBytes(doc.size, locale),
    formatShortDate(new Date(doc.createdAt), locale),
    provider ? t(provider.nameKey) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const onExport = async () => {
    if (!handle) return;
    const ok = await exportFile(handle.uri, doc.mimeType, doc.name);
    if (!ok) toast.show(t('secondBrain.viewer.exportUnavailable'), 'error');
  };

  const onRename = async () => {
    const name = await dialog.prompt({
      title: t('secondBrain.rename'),
      label: t('secondBrain.documentName'),
      initialValue: doc.name,
      confirmLabel: t('common.save'),
    });
    if (name && name !== doc.name) rename.mutate({ id: doc.id, name });
  };

  const onDelete = async () => {
    const ok = await dialog.confirm({
      title: t('secondBrain.deleteDocumentTitle'),
      message: t('secondBrain.deleteDocumentMessage', { name: doc.name }),
      confirmLabel: t('common.delete'),
      destructive: true,
    });
    if (ok) remove.mutate([doc.id], { onSuccess: back });
  };

  const fileError = file.error instanceof StorageProviderError ? file.error.code : file.error ? 'unknown' : null;

  return (
    <Screen scroll={false}>
      <PageHeader
        title={doc.name}
        subtitle={subtitle}
        onBack={back}
        actions={
          <>
            <IconButton
              icon={exportMode === 'share' ? 'share' : 'download'}
              label={exportMode === 'share' ? t('secondBrain.viewer.openWith') : t('secondBrain.viewer.download')}
              variant="surface"
              onPress={() => void onExport()}
              disabled={!handle}
            />
            <IconButton icon="edit-2" label={t('secondBrain.rename')} variant="surface" onPress={() => void onRename()} />
            <IconButton icon="corner-down-right" label={t('secondBrain.move.action')} variant="surface" onPress={() => setMoving(true)} />
            <IconButton icon="trash-2" label={t('common.delete')} variant="surface" onPress={() => void onDelete()} />
          </>
        }
      />
      <Card padded={!isCompact} style={{ flex: 1, overflow: 'hidden', minHeight: 320 }}>
        {file.isLoading ? (
          <LoadingState label={t('secondBrain.viewer.loading')} />
        ) : fileError === 'not-found' ? (
          <EmptyState icon="alert-circle" title={t('secondBrain.viewer.missing')} description={t('secondBrain.viewer.missingHint')} />
        ) : fileError === 'auth-expired' || fileError === 'not-connected' ? (
          <EmptyState
            icon="link"
            accent={secondBrainMeta.accent}
            title={t('secondBrain.viewer.reconnectTitle')}
            description={t(`secondBrain.viewer.errors.${fileError}`)}
            actionLabel={t('secondBrain.viewer.reconnect')}
            onAction={() => router.navigate('/settings/storage')}
          />
        ) : fileError ? (
          <ErrorState
            message={t(`secondBrain.viewer.errors.${fileError === 'unavailable' ? 'unavailable' : 'unknown'}`)}
            onRetry={() => void file.refetch()}
          />
        ) : handle ? (
          <View style={{ flex: 1 }}>
            <DocumentViewer doc={doc} uri={handle.uri} />
          </View>
        ) : null}
      </Card>
      <MoveSheet visible={moving} onClose={() => setMoving(false)} folderIds={[]} documentIds={[doc.id]} currentFolderId={doc.folderId} />
    </Screen>
  );
}
