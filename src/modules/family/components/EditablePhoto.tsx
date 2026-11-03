import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useToast } from '@/components/feedback/ToastProvider';
import { Icon } from '@/components/ui/Icon';
import { interaction } from '@/components/ui/interaction';
import type { UploadSource } from '@/storage/providers/types';
import { useTheme } from '@/theme';
import { pickProfilePhoto } from '../photo';

/** A profile circle you tap to pick a new photo (camera badge in the corner). */
export function EditablePhoto({
  size,
  hasPhoto,
  onPick,
  children,
}: {
  size: number;
  hasPhoto: boolean;
  onPick: (source: UploadSource) => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const { colors } = useTheme();
  const badge = Math.max(26, Math.round(size * 0.32));
  const pick = async () => {
    const source = await pickProfilePhoto();
    if (source === 'denied') toast.show(t('family.photo.denied'), 'error');
    else if (source) onPick(source);
  };
  return (
    <Pressable
      onPress={() => void pick()}
      accessibilityRole="button"
      accessibilityLabel={hasPhoto ? t('family.photo.change') : t('family.photo.add')}
      style={(s) => ({ width: size, height: size, opacity: interaction(s).pressed ? 0.8 : 1 })}
    >
      {children}
      <View
        style={{
          position: 'absolute',
          right: -2,
          bottom: -2,
          width: badge,
          height: badge,
          borderRadius: badge / 2,
          backgroundColor: colors.primary,
          borderWidth: 2,
          borderColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="camera" size={Math.round(badge * 0.5)} color={colors.onPrimary} />
      </View>
    </Pressable>
  );
}
