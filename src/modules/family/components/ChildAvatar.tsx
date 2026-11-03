import { Image } from 'expo-image';

import { Avatar } from '@/components/ui/Avatar';
import { useChildPhotoUri } from '../hooks';
import { photoKey, usePersonPhoto } from '../personPhotos';
import type { Child } from '../types';

/** Profile photo (synced with the family; else the one on this device) or coloured initials. */
export function ChildAvatar({ child, size = 44 }: { child: Pick<Child, 'name' | 'color' | 'photo'> & { id?: string }; size?: number }) {
  const synced = usePersonPhoto(child.id ? photoKey.child(child.id) : null);
  const local = useChildPhotoUri(synced ? null : child.photo);
  const uri = synced ?? local;
  if (!uri) return <Avatar name={child.name} color={child.color} size={size} />;
  return (
    <Image
      source={{ uri }}
      accessibilityLabel={child.name}
      contentFit="cover"
      style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: child.color }}
    />
  );
}
