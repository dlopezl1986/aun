import { useTranslation } from 'react-i18next';

import { ListRow } from '@/components/ui/ListRow';
import { Sheet } from '@/components/ui/Sheet';
import { secondBrainMeta } from '../meta';

interface Props {
  visible: boolean;
  onClose: () => void;
  onFiles: () => void;
  onPhotos: () => void;
}

/** iOS/Android: choose where to import from (Files app or photo library). */
export function ImportSourceSheet({ visible, onClose, onFiles, onPhotos }: Props) {
  const { t } = useTranslation();
  const pick = (fn: () => void) => () => {
    onClose();
    // Let the sheet close before the system picker opens (iOS presents one modal at a time).
    setTimeout(fn, 350);
  };
  if (!visible) return null;
  return (
    <Sheet visible onClose={onClose} title={t('secondBrain.import.title')} subtitle={t('secondBrain.import.subtitle')}>
      <ListRow
        icon="folder"
        accent={secondBrainMeta.accent}
        title={t('secondBrain.import.fromFiles')}
        subtitle={t('secondBrain.import.fromFilesHint')}
        chevron
        onPress={pick(onFiles)}
      />
      <ListRow
        icon="image"
        accent="#0EA5A4"
        title={t('secondBrain.import.fromPhotos')}
        subtitle={t('secondBrain.import.fromPhotosHint')}
        chevron
        onPress={pick(onPhotos)}
      />
    </Sheet>
  );
}
