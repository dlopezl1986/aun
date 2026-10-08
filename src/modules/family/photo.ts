import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import type { UploadSource } from '@/storage/providers/types';

/**
 * Picks one square-cropped photo for a profile. Web uses the browser file
 * dialog (no permission needed); iOS/Android ask for gallery access.
 */
export async function pickProfilePhoto(): Promise<UploadSource | 'denied' | null> {
  if (Platform.OS !== 'web') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return 'denied';
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  if (result.canceled || !result.assets[0]) return null;
  const a = result.assets[0];
  const mimeType = a.mimeType ?? 'image/jpeg';
  const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
  return { uri: a.uri, name: a.fileName ?? `profile-${Date.now()}.${ext}`, mimeType, size: a.fileSize, file: a.file };
}
