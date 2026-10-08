import { Image } from 'expo-image';

import { Avatar } from '@/components/ui/Avatar';
import { useChildPhotoUri } from '../hooks';
import type { Child } from '../types';

/** Child photo (stored on this device) or coloured initials. */
export function ChildAvatar({ child, size = 44 }: { child: Pick<Child, 'name' | 'color' | 'photo'>; size?: number }) {
  const uri = useChildPhotoUri(child.photo);
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
