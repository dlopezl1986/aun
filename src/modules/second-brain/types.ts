import type { StoredFileRef } from '@/storage/providers/types';
import type { BaseEntity } from '@/types/entity';

/** Folders form an unlimited-depth tree through `parentId`. */
export interface Folder extends BaseEntity {
  name: string;
  parentId: string | null;
  color?: string | null;
}

/**
 * Document metadata lives in AUN; the binary lives in the active
 * StorageProvider (`storage`). This split enables search, relations, tags,
 * OCR/AI indexing and provider migration later.
 */
export interface DocumentItem extends BaseEntity {
  name: string;
  folderId: string | null;
  mimeType: string;
  extension: string;
  size: number;
  storage: StoredFileRef;
  tags: string[];
  /** Future: OCR / AI extracted text for content search. */
  indexedText?: string | null;
}

export interface FolderContents {
  folders: (Folder & { childCount: number })[];
  documents: DocumentItem[];
}
