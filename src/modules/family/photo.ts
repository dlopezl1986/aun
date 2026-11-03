import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
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

/** Small square-ish JPEG (data URI) of a photo, light enough to sync with the family. */
export async function makeThumbnail(uri: string): Promise<string> {
  const out = await manipulateAsync(uri, [{ resize: { width: 320 } }], { compress: 0.7, format: SaveFormat.JPEG, base64: true });
  if (!out.base64) throw new Error('No image data');
  return `data:image/jpeg;base64,${out.base64}`;
}
