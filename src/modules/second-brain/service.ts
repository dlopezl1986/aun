import type { StorageService } from '@/services/storage/StorageService';
import { StorageProviderError } from '@/storage/providers/errors';
import { baseNameOf, extensionOf } from '@/storage/providers/local/fileName';
import type { LocalFileHandle, UploadSource } from '@/storage/providers/types';
import type { Repository } from '@/storage/repository';
import { matchScore, type SearchResult } from '@/types/search';
import { fileTypeFor } from './fileTypes';
import type { DocumentItem, Folder, FolderContents } from './types';

export type ImportRejection = 'unsupported' | 'too-large' | 'quota' | 'unavailable' | 'failed';

export interface ImportResult {
  imported: DocumentItem[];
  rejected: { name: string; reason: ImportRejection }[];
}

export interface DeleteResult {
  deleted: number;
  /** Documents whose binary could not be removed from their provider (kept). */
  failed: string[];
}

export class FolderNameError extends Error {
  constructor(public readonly reason: 'empty' | 'duplicate' | 'cycle') {
    super(reason);
    this.name = 'FolderNameError';
  }
}

/**
 * 2ndBrain domain service. Folder/document *metadata* is kept here; file
 * binaries go through the StorageProvider abstraction (Phase 3).
 */
export class SecondBrainService {
  constructor(
    private readonly folders: Repository<Folder>,
    private readonly documents: Repository<DocumentItem>,
    private readonly storage: StorageService,
  ) {}

  listFolders(): Promise<Folder[]> {
    return this.folders.list();
  }

  async contents(parentId: string | null): Promise<FolderContents> {
    const all = await this.folders.list();
    const docs = await this.documents.list();
    const childCount = (id: string) => all.filter((f) => f.parentId === id).length + docs.filter((d) => d.folderId === id).length;
    return {
      folders: all
        .filter((f) => f.parentId === parentId)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((f) => ({ ...f, childCount: childCount(f.id) })),
      documents: docs.filter((d) => d.folderId === parentId).sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  /** Root → … → folder. */
  async breadcrumb(folderId: string | null): Promise<Folder[]> {
    if (!folderId) return [];
    const byId = new Map((await this.folders.list()).map((f) => [f.id, f]));
    const path: Folder[] = [];
    let current = byId.get(folderId);
    const guard = new Set<string>();
    while (current && !guard.has(current.id)) {
      guard.add(current.id);
      path.unshift(current);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return path;
  }

  private async assertUniqueName(name: string, parentId: string | null, exceptId?: string) {
    const trimmed = name.trim();
    if (!trimmed) throw new FolderNameError('empty');
    const siblings = (await this.folders.list()).filter((f) => f.parentId === parentId && f.id !== exceptId);
    if (siblings.some((f) => f.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase())) throw new FolderNameError('duplicate');
    return trimmed;
  }

  async createFolder(name: string, parentId: string | null): Promise<Folder> {
    const trimmed = await this.assertUniqueName(name, parentId);
    return this.folders.create({ name: trimmed, parentId, color: null });
  }

  async renameFolder(id: string, name: string): Promise<Folder> {
    const folder = await this.folders.get(id);
    if (!folder) throw new Error('Folder not found');
    const trimmed = await this.assertUniqueName(name, folder.parentId, id);
    return this.folders.update(id, { name: trimmed });
  }

  async moveFolder(id: string, newParentId: string | null): Promise<Folder> {
    if (newParentId) {
      const path = await this.breadcrumb(newParentId);
      if (path.some((f) => f.id === id)) throw new FolderNameError('cycle');
    }
    const folder = await this.folders.get(id);
    if (!folder) throw new Error('Folder not found');
    await this.assertUniqueName(folder.name, newParentId, id);
    return this.folders.update(id, { parentId: newParentId });
  }

  /** Ids of the folders and all their descendants. */
  private async descendants(ids: string[]): Promise<string[]> {
    const all = await this.folders.list();
    const result = new Set(ids);
    let added = true;
    while (added) {
      added = false;
      for (const f of all) {
        if (f.parentId && result.has(f.parentId) && !result.has(f.id)) {
          result.add(f.id);
          added = true;
        }
      }
    }
    return [...result];
  }

  /** Counts what a (bulk) delete would remove, for the confirmation dialog. */
  async deletionImpact(ids: string[]): Promise<{ folders: number; documents: number }> {
    const all = await this.descendants(ids);
    const set = new Set(all);
    const docs = (await this.documents.list()).filter((d) => d.folderId && set.has(d.folderId));
    return { folders: all.length, documents: docs.length };
  }

  /**
   * Deletes folders recursively with their documents (binaries included).
   * Folders containing a document whose file could not be removed are kept.
   */
  async deleteFolders(ids: string[]): Promise<DeleteResult> {
    const all = await this.descendants(ids);
    const set = new Set(all);
    const docIds = (await this.documents.list()).filter((d) => d.folderId && set.has(d.folderId)).map((d) => d.id);
    const result = await this.deleteDocuments(docIds);
    if (result.failed.length) {
      const keep = new Set((await this.documents.list()).filter((d) => result.failed.includes(d.id)).map((d) => d.folderId));
      // Keep every ancestor of a folder that still holds documents.
      const byId = new Map((await this.folders.list()).map((f) => [f.id, f]));
      for (const id of [...keep]) {
        let current = id ? byId.get(id) : undefined;
        while (current) {
          keep.add(current.id);
          current = current.parentId ? byId.get(current.parentId) : undefined;
        }
      }
      await this.folders.removeMany(all.filter((id) => !keep.has(id)));
    } else {
      await this.folders.removeMany(all);
    }
    return result;
  }

  // ---------- Documents ----------

  getDocument(id: string): Promise<DocumentItem | null> {
    return this.documents.get(id);
  }

  /** "foto.jpg" → "foto (2).jpg" when the name is taken in the folder. */
  private async uniqueDocumentName(name: string, folderId: string | null, exceptId?: string): Promise<string> {
    const taken = new Set(
      (await this.documents.list()).filter((d) => d.folderId === folderId && d.id !== exceptId).map((d) => d.name.toLocaleLowerCase()),
    );
    if (!taken.has(name.toLocaleLowerCase())) return name;
    const ext = extensionOf(name);
    const base = baseNameOf(name);
    for (let i = 2; ; i += 1) {
      const candidate = ext ? `${base} (${i}).${ext}` : `${base} (${i})`;
      if (!taken.has(candidate.toLocaleLowerCase())) return candidate;
    }
  }

  /** Imports picked files into a folder through the ACTIVE storage provider. */
  async importDocuments(sources: UploadSource[], folderId: string | null): Promise<ImportResult> {
    const result: ImportResult = { imported: [], rejected: [] };
    let provider;
    try {
      provider = this.storage.active();
      await provider.initialize();
    } catch {
      return { imported: [], rejected: sources.map((s) => ({ name: s.name, reason: 'unavailable' })) };
    }
    const maxBytes = this.storage.maxFileBytes();
    for (const source of sources) {
      const type = fileTypeFor(source.name);
      if (!type) {
        result.rejected.push({ name: source.name, reason: 'unsupported' });
        continue;
      }
      if (source.size && source.size > maxBytes) {
        result.rejected.push({ name: source.name, reason: 'too-large' });
        continue;
      }
      try {
        const name = await this.uniqueDocumentName(source.name, folderId);
        const mimeType = source.mimeType || type.mimeTypes[0];
        const meta = await provider.uploadFile({ ...source, name, mimeType }, null);
        const doc = await this.documents.create({
          name,
          folderId,
          mimeType,
          extension: extensionOf(name),
          size: meta.size || source.size || 0,
          storage: { providerId: meta.providerId, providerFileId: meta.providerFileId },
          tags: [],
          indexedText: null,
        });
        result.imported.push(doc);
      } catch (e) {
        const reason: ImportRejection =
          e instanceof StorageProviderError && (e.code === 'quota' || e.code === 'too-large') ? e.code : 'failed';
        result.rejected.push({ name: source.name, reason });
      }
    }
    return result;
  }

  /** Local URI to view/share a document (web: temporary blob URL, call release()). */
  openDocument(doc: DocumentItem): Promise<LocalFileHandle> {
    return this.storage.forRef(doc.storage).downloadFile(doc.storage);
  }

  /** Renames a document, keeping its extension when the user omits it. */
  async renameDocument(id: string, newName: string): Promise<DocumentItem> {
    const doc = await this.documents.get(id);
    if (!doc) throw new Error('Document not found');
    let name = newName.trim();
    if (!name) throw new FolderNameError('empty');
    if (doc.extension && extensionOf(name) !== doc.extension) name = `${name}.${doc.extension}`;
    const siblings = (await this.documents.list()).filter((d) => d.folderId === doc.folderId && d.id !== id);
    if (siblings.some((d) => d.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw new FolderNameError('duplicate');
    await this.storage.forRef(doc.storage).renameFile(doc.storage, name);
    return this.documents.update(id, { name });
  }

  /** Moves folders and/or documents into `targetFolderId` (null = root). */
  async moveItems(items: { folderIds: string[]; documentIds: string[] }, targetFolderId: string | null): Promise<void> {
    for (const id of items.folderIds) await this.moveFolder(id, targetFolderId);
    for (const id of items.documentIds) {
      const doc = await this.documents.get(id);
      if (!doc || doc.folderId === targetFolderId) continue;
      const name = await this.uniqueDocumentName(doc.name, targetFolderId, id);
      // Folders are AUN metadata: the binary stays where it is in its provider.
      await this.documents.update(id, { folderId: targetFolderId, name });
    }
  }

  /** Deletes documents and their binaries. Never drops metadata of a file it couldn't delete. */
  async deleteDocuments(ids: string[]): Promise<DeleteResult> {
    const docs = (await this.documents.list()).filter((d) => ids.includes(d.id));
    const removed: string[] = [];
    const failed: string[] = [];
    for (const doc of docs) {
      try {
        await this.storage.forRef(doc.storage).deleteFile(doc.storage);
        removed.push(doc.id);
      } catch (e) {
        if (e instanceof StorageProviderError && e.code === 'not-found') removed.push(doc.id);
        else failed.push(doc.id);
      }
    }
    await this.documents.removeMany(removed);
    return { deleted: removed.length, failed };
  }

  /** Documents as link targets: by name, or the most recent when no query. */
  async linkableDocuments(query: string, ids?: string[]): Promise<{ doc: DocumentItem; folderName?: string }[]> {
    const folders = new Map((await this.folders.list()).map((f) => [f.id, f.name]));
    let docs = await this.documents.list();
    if (ids) docs = docs.filter((d) => ids.includes(d.id));
    else if (query) docs = docs.filter((d) => matchScore(d.name, query) > 0);
    else docs = docs.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 30);
    return docs.map((doc) => ({ doc, folderName: doc.folderId ? folders.get(doc.folderId) : undefined }));
  }

  /** Documents per storage provider (shown before switching provider). */
  async countByProvider(): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const d of await this.documents.list()) counts[d.storage.providerId] = (counts[d.storage.providerId] ?? 0) + 1;
    return counts;
  }

  async stats(): Promise<{ documents: number; bytes: number; folders: number }> {
    const docs = await this.documents.list();
    return {
      documents: docs.length,
      bytes: docs.reduce((sum, d) => sum + (d.size || 0), 0),
      folders: (await this.folders.list()).length,
    };
  }

  /** Name search across folders and documents (section 17). */
  async search(text: string): Promise<SearchResult[]> {
    const folders = await this.folders.list();
    const byId = new Map(folders.map((f) => [f.id, f]));
    const results: SearchResult[] = [];
    for (const f of folders) {
      const score = matchScore(f.name, text);
      if (!score) continue;
      results.push({
        ref: { module: 'second-brain', type: 'folder', id: f.id },
        title: f.name,
        kindKey: 'search.kinds.folder',
        subtitle: f.parentId ? byId.get(f.parentId)?.name : undefined,
        score,
        route: `/second-brain?folder=${f.id}`,
      });
    }
    for (const d of await this.documents.list()) {
      const score = matchScore(d.name, text);
      if (!score) continue;
      results.push({
        ref: { module: 'second-brain', type: 'document', id: d.id },
        title: d.name,
        kindKey: 'search.kinds.document',
        subtitle: d.folderId ? byId.get(d.folderId)?.name : undefined,
        score,
        route: d.folderId ? `/second-brain?folder=${d.folderId}` : '/second-brain',
      });
    }
    return results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  }
}
