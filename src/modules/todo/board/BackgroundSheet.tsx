import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useToast } from '@/components/feedback/ToastProvider';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { useTheme } from '@/theme';
import { defaultBackground, pickBackgroundPhoto, WALLPAPERS } from './backgrounds';

interface Props {
  visible: boolean;
  boardId: string;
  value: string | null;
  onChange: (value: string | null) => void;
  onClose: () => void;
}

/** «Fondo del tablero»: preset wallpapers, or a photo of your own. */
export function BackgroundSheet({ visible, boardId, value, onChange, onClose }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const { spacing, radius, colors } = useTheme();
  const [busy, setBusy] = useState(false);
  if (!visible) return null;

  const current = value || defaultBackground(boardId);
  const custom = current.startsWith('data:image/') ? current : null;

  const pickPhoto = async () => {
    setBusy(true);
    try {
      const photo = await pickBackgroundPhoto();
      if (photo === 'denied') toast.show(t('todo.background.denied'), 'error');
      else if (photo) onChange(photo);
    } catch {
      toast.show(t('common.errorDescription'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const tile = (key: string, source: unknown, selected: boolean, onPress: () => void, label: string) => (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole="radio"
      aria-checked={selected}
      accessibilityLabel={label}
      style={{
        width: '31%',
        aspectRatio: 1.5,
        borderRadius: radius.md,
        overflow: 'hidden',
        borderWidth: 3,
        borderColor: selected ? colors.primary : 'transparent',
      }}
    >
      <Image source={source as never} style={{ flex: 1 }} contentFit="cover" />
      {selected ? (
        <View
          style={{
            position: 'absolute',
            right: 6,
            top: 6,
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="check" size={13} color="#FFFFFF" />
        </View>
      ) : null}
    </Pressable>
  );

  return (
    <Sheet visible onClose={onClose} title={t('todo.background.title')} subtitle={t('todo.background.subtitle')}>
      <View
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between' }}
        accessibilityRole="radiogroup"
      >
        {custom ? tile('custom', { uri: custom }, true, () => undefined, t('todo.background.yourPhoto')) : null}
        {WALLPAPERS.map((w) =>
          tile(w.id, w.source, current === `wp:${w.id}`, () => onChange(`wp:${w.id}`), t(`todo.background.names.${w.id}`)),
        )}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
        <Button label={t('todo.background.usePhoto')} icon="image" variant="secondary" onPress={pickPhoto} loading={busy} />
        {custom ? <Button label={t('todo.background.removePhoto')} icon="x" variant="ghost" onPress={() => onChange(null)} /> : null}
      </View>
    </Sheet>
  );
}
