import { useTranslation } from 'react-i18next';

import { useToast } from '@/components/feedback/ToastProvider';
import { useImportDocuments } from './hooks';
import { pickFromFiles, pickFromPhotos } from './pickers';

/** Pick + import flow shared by 2ndBrain screens and quick actions. */
export function useImporter(folderId: string | null) {
  const { t } = useTranslation();
  const toast = useToast();
  const importDocs = useImportDocuments();

  const run = async (source: 'files' | 'photos') => {
    try {
      const picked = source === 'files' ? await pickFromFiles() : await pickFromPhotos();
      if (picked === 'denied') {
        toast.show(t('secondBrain.import.photosDenied'), 'error');
        return;
      }
      if (!picked.length) return;
      importDocs.mutate({ sources: picked, folderId });
    } catch {
      toast.show(t('secondBrain.import.pickerError'), 'error');
    }
  };

  return { pickFiles: () => run('files'), pickPhotos: () => run('photos'), importing: importDocs.isPending };
}
