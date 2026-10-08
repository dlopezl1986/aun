import { Platform } from 'react-native';

import type { IconName } from '@/components/ui/Icon';
import { featureFlags } from '@/config/featureFlags';
import { googleDriveSupport } from '@/services/oauth/googleOAuth';
import type { StorageProviderId } from './types';

export interface StorageProviderDescriptor {
  id: StorageProviderId;
  nameKey: string;
  descriptionKey: string;
  icon: IconName;
  /** Platforms where the provider can technically work. */
  platforms: readonly ('ios' | 'android' | 'web')[];
  /** Whether the implementation is shipped in this build. */
  implemented: boolean;
  /** Max size per file accepted in 2ndBrain. */
  maxFileSizeMB: number;
}

export const storageProviderDescriptors: StorageProviderDescriptor[] = [
  {
    id: 'local',
    nameKey: 'storage.providers.local.name',
    descriptionKey: 'storage.providers.local.description',
    icon: 'hard-drive',
    platforms: ['ios', 'android', 'web'],
    implemented: true,
    // Web stores files in IndexedDB: keep individual files reasonable.
    maxFileSizeMB: Platform.OS === 'web' ? 100 : 500,
  },
  {
    id: 'google-drive',
    nameKey: 'storage.providers.googleDrive.name',
    descriptionKey: 'storage.providers.googleDrive.description',
    icon: 'triangle',
    platforms: ['ios', 'android', 'web'],
    implemented: featureFlags.storageGoogleDrive,
    maxFileSizeMB: 500,
  },
  {
    id: 'icloud',
    nameKey: 'storage.providers.icloud.name',
    descriptionKey: 'storage.providers.icloud.description',
    icon: 'cloud',
    // iCloud Drive is only reachable through Apple's native APIs on iOS.
    platforms: ['ios'],
    implemented: featureFlags.storageICloud,
    maxFileSizeMB: 500,
  },
];

export type ProviderAvailability = { available: true } | { available: false; reasonKey: string };

export function getProviderAvailability(d: StorageProviderDescriptor): ProviderAvailability {
  const os = Platform.OS as 'ios' | 'android' | 'web';
  if (!d.platforms.includes(os)) return { available: false, reasonKey: 'storage.unavailable.platform' };
  if (!d.implemented) return { available: false, reasonKey: 'storage.unavailable.notYet' };
  if (d.id === 'google-drive') {
    const support = googleDriveSupport();
    if (!support.supported) return { available: false, reasonKey: `storage.unavailable.${support.reason}` };
  }
  return { available: true };
}

export function getProviderDescriptor(id: StorageProviderId): StorageProviderDescriptor | undefined {
  return storageProviderDescriptors.find((d) => d.id === id);
}
