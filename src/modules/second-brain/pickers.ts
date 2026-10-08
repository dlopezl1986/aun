import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { extensionOf } from '@/storage/providers/local/fileName';
import type { UploadSource } from '@/storage/providers/types';
import { fileTypes, supportedExtensions } from './fileTypes';

const MIME_TYPES = fileTypes.flatMap((f) => f.mimeTypes);

/** Pick documents from the system file picker (Files / Drive / downloads…). */
export async function pickFromFiles(): Promise<UploadSource[]> {
  const result = await DocumentPicker.getDocumentAsync({
    multiple: true,
    copyToCacheDirectory: true,
    // Browsers often report HEIC/Office files without a MIME type: accept by extension too.
    type: Platform.OS === 'web' ? [...MIME_TYPES, ...supportedExtensions.map((e) => `.${e}`)] : MIME_TYPES,
    base64: false,
  });
  if (result.canceled) return [];
  return result.assets.map((a) => ({
    uri: a.uri,
    name: a.name,
    mimeType: a.mimeType ?? '',
    size: a.size,
    file: a.file,
  }));
}

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/**
 * Pick photos from the gallery (iOS / Android). Keeps the original format
 * on iOS (HEIC stays HEIC) instead of transcoding to JPEG.
 */
export async function pickFromPhotos(): Promise<UploadSource[] | 'denied'> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return 'denied';
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: 0,
    quality: 1,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
  });
  if (result.canceled) return [];
  return result.assets.map((a, i) => {
    const mimeType = a.mimeType ?? 'image/jpeg';
    const fallbackExt = EXT_BY_MIME[mimeType] ?? 'jpg';
    let name = a.fileName ?? `IMG_${Date.now()}_${i + 1}.${fallbackExt}`;
    if (!extensionOf(name)) name = `${name}.${fallbackExt}`;
    return { uri: a.uri, name, mimeType, size: a.fileSize };
  });
}

export const canPickPhotos = Platform.OS !== 'web';
