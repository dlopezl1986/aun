import { useTranslation } from 'react-i18next';

import { useToast } from '@/components/feedback/ToastProvider';
import { useDataMutation, useDataQuery } from '@/state/queryClient';
import type { UploadSource } from '@/storage/providers/types';
import { FolderNameError, type DeleteResult, type ImportResult } from './service';

export function useFolderContents(parentId: string | null) {
  return useDataQuery('folders', ['contents', parentId], (s) => s.secondBrain.contents(parentId));
}

export function useBreadcrumb(folderId: string | null) {
  return useDataQuery('folders', ['breadcrumb', folderId], (s) => s.secondBrain.breadcrumb(folderId));
}

export function useAllFolders() {
  return useDataQuery('folders', ['all'], (s) => s.secondBrain.listFolders());
}

export function useSecondBrainSearch(text: string) {
  return useDataQuery('folders', ['search', text.trim().toLowerCase()], (s) => s.secondBrain.search(text));
}

function useFolderError() {
  const { t } = useTranslation();
  return (e: unknown) => (e instanceof FolderNameError ? t(`secondBrain.errors.${e.reason}`) : t('common.errorDescription'));
}

export function useCreateFolder() {
  const { t } = useTranslation();
  const errorMessage = useFolderError();
  return useDataMutation((s, v: { name: string; parentId: string | null }) => s.secondBrain.createFolder(v.name, v.parentId), {
    invalidate: ['folders'],
    successMessage: t('secondBrain.toast.folderCreated'),
    errorMessage,
  });
}

export function useRenameFolder() {
  const { t } = useTranslation();
  const errorMessage = useFolderError();
  return useDataMutation((s, v: { id: string; name: string }) => s.secondBrain.renameFolder(v.id, v.name), {
    invalidate: ['folders'],
    successMessage: t('secondBrain.toast.renamed'),
    errorMessage,
  });
}

export function useDeleteFolders() {
  const { t } = useTranslation();
  return useDataMutation((s, ids: string[]) => s.secondBrain.deleteFolders(ids), {
    invalidate: ['folders'],
    successMessage: (r: DeleteResult) =>
      r.failed.length ? t('secondBrain.toast.partialDelete', { count: r.failed.length }) : t('secondBrain.toast.deleted'),
  });
}

// ---------- Documents ----------

export function useDocument(id: string) {
  return useDataQuery('folders', ['document', id], (s) => s.secondBrain.getDocument(id));
}

export function useStorageStats() {
  return useDataQuery('folders', ['stats'], (s) => s.secondBrain.stats());
}

export function useImportDocuments() {
  const { t } = useTranslation();
  const toast = useToast();
  return useDataMutation(
    (s, v: { sources: UploadSource[]; folderId: string | null }) => s.secondBrain.importDocuments(v.sources, v.folderId),
    {
      invalidate: ['folders'],
      // Mixed results produce ONE combined message (a second toast would replace the first).
      successMessage: (r: ImportResult) =>
        r.imported.length && !r.rejected.length ? t('secondBrain.import.done', { count: r.imported.length }) : '',
      onResult: (r: ImportResult) => {
        if (!r.rejected.length) return;
        const names = r.rejected.map((x) => x.name).join(', ');
        const rejected = t(`secondBrain.import.rejected.${r.rejected[0].reason}`, { count: r.rejected.length, names });
        if (r.imported.length) toast.show(`${t('secondBrain.import.done', { count: r.imported.length })}. ${rejected}`, 'info');
        else toast.show(rejected, 'error');
      },
    },
  );
}

export function useRenameDocument() {
  const { t } = useTranslation();
  const errorMessage = useFolderError();
  return useDataMutation((s, v: { id: string; name: string }) => s.secondBrain.renameDocument(v.id, v.name), {
    invalidate: ['folders'],
    successMessage: t('secondBrain.toast.renamed'),
    errorMessage,
  });
}

export function useMoveItems() {
  const { t } = useTranslation();
  const errorMessage = useFolderError();
  return useDataMutation(
    (s, v: { folderIds: string[]; documentIds: string[]; target: string | null }) =>
      s.secondBrain.moveItems({ folderIds: v.folderIds, documentIds: v.documentIds }, v.target),
    { invalidate: ['folders'], successMessage: t('secondBrain.toast.moved'), errorMessage },
  );
}

export function useDeleteDocuments() {
  const { t } = useTranslation();
  return useDataMutation((s, ids: string[]) => s.secondBrain.deleteDocuments(ids), {
    invalidate: ['folders'],
    successMessage: (r: DeleteResult) =>
      r.failed.length ? t('secondBrain.toast.partialDelete', { count: r.failed.length }) : t('secondBrain.toast.deleted'),
  });
}
