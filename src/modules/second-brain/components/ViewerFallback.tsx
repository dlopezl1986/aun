import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/feedback/ToastProvider';
import { fileTypeFor } from '../fileTypes';
import { secondBrainMeta } from '../meta';
import { exportFile, exportMode } from '../share';
import type { DocumentItem } from '../types';

export type FallbackReason = 'platform' | 'format' | 'browser';

/**
 * Shown when a format can't be displayed inside AUN on this platform.
 * Never a blank screen (section 16): explains why and offers an alternative.
 */
export function ViewerFallback({ doc, uri, reason }: { doc: DocumentItem; uri: string; reason: FallbackReason }) {
  const { t } = useTranslation();
  const toast = useToast();
  const type = fileTypeFor(doc.name);
  const typeLabel = type ? t(type.labelKey) : doc.extension.toUpperCase();

  const onExport = async () => {
    const ok = await exportFile(uri, doc.mimeType, doc.name);
    if (!ok) toast.show(t('secondBrain.viewer.exportUnavailable'), 'error');
  };

  return (
    <EmptyState
      icon={type?.icon ?? 'file'}
      accent={secondBrainMeta.accent}
      title={t(`secondBrain.viewer.fallback.${reason}.title`, { type: typeLabel })}
      description={t(`secondBrain.viewer.fallback.${reason}.description`, { type: typeLabel })}
      secondary={
        <Button
          label={exportMode === 'share' ? t('secondBrain.viewer.openWith') : t('secondBrain.viewer.download')}
          icon={exportMode === 'share' ? 'share' : 'download'}
          onPress={() => void onExport()}
          style={{ alignSelf: 'center', marginTop: 8 }}
        />
      }
    />
  );
}
