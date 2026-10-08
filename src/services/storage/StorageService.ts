import { getProviderDescriptor } from '@/storage/providers/descriptors';
import { getStorageProvider } from '@/storage/providers/factory';
import type { StorageProvider, StorageProviderId, StoredFileRef } from '@/storage/providers/types';

/**
 * StorageService (section 43): the only entry point 2ndBrain uses to reach
 * binaries. New files go to the user's ACTIVE provider; existing files are
 * always served by the provider they were stored with, so switching provider
 * never breaks older documents (and a future "Migrar documentos" can move them).
 */
export class StorageService {
  constructor(
    private readonly userId: string,
    private readonly activeProviderId: () => StorageProviderId,
  ) {}

  activeId(): StorageProviderId {
    return this.activeProviderId();
  }

  active(): StorageProvider {
    return getStorageProvider(this.activeId(), this.userId);
  }

  forRef(ref: StoredFileRef): StorageProvider {
    return getStorageProvider(ref.providerId, this.userId);
  }

  /** Max bytes per file accepted by the active provider. */
  maxFileBytes(): number {
    return (getProviderDescriptor(this.activeId())?.maxFileSizeMB ?? 100) * 1024 * 1024;
  }
}
