import type { StorageService } from '@/services/storage/StorageService';
import { StorageProviderError } from '@/storage/providers/errors';
import type { StorageProvider, UploadSource } from '@/storage/providers/types';
import { LocalRepository } from '@/storage/repository';
import { memoryStore } from '@/test/memoryStore';
import { FolderNameError, SecondBrainService } from '../service';
import type { DocumentItem, Folder } from '../types';

// jest.mock factories run lazily and must use require().
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/utils/id', () => {
  let i = 0;
  return { createId: () => `id-${++i}` };
});

/** In-memory fake provider: records binaries, can be told to fail deletes. */
function fakeProvider() {
  const files = new Map<string, string>();
  const failDeletes = new Set<string>();
  const provider = {
    id: 'local',
    initialize: jest.fn(async () => undefined),
    uploadFile: jest.fn(async (s: UploadSource) => {
      const key = `bin-${files.size + 1}`;
      files.set(key, s.name);
      return {
        providerId: 'local',
        providerFileId: key,
        name: s.name,
        mimeType: s.mimeType,
        size: s.size ?? 10,
        modifiedAt: '',
        parentId: null,
      };
    }),
    deleteFile: jest.fn(async (ref: { providerFileId: string }) => {
      if (failDeletes.has(ref.providerFileId)) throw new StorageProviderError('network', 'local');
      files.delete(ref.providerFileId);
    }),
    renameFile: jest.fn(async () => ({})),
    downloadFile: jest.fn(async () => ({ uri: 'file://x' })),
  } as unknown as StorageProvider;
  return { provider, files, failDeletes };
}

function setup(maxBytes = 1000) {
  const kv = memoryStore();
  const fake = fakeProvider();
  const storage = {
    activeId: () => 'local',
    active: () => fake.provider,
    forRef: () => fake.provider,
    maxFileBytes: () => maxBytes,
  } as unknown as StorageService;
  const service = new SecondBrainService(
    new LocalRepository<Folder>(kv, 'u1', 'folders'),
    new LocalRepository<DocumentItem>(kv, 'u1', 'documents'),
    storage,
  );
  return { service, ...fake };
}

const src = (name: string, size = 10): UploadSource => ({ uri: `file://${name}`, name, mimeType: '', size });

describe('SecondBrainService documents', () => {
  it('imports supported files, de-duplicates names and rejects unsupported/too large ones', async () => {
    const { service } = setup(100);
    const first = await service.importDocuments([src('Seguro.pdf')], null);
    expect(first.imported).toHaveLength(1);
    const second = await service.importDocuments([src('Seguro.pdf'), src('notas.txt'), src('Video.png', 500), src('Foto.HEIC')], null);
    expect(second.imported.map((d) => d.name)).toEqual(['Seguro (2).pdf', 'Foto.HEIC']);
    expect(second.rejected).toEqual([
      { name: 'notas.txt', reason: 'unsupported' },
      { name: 'Video.png', reason: 'too-large' },
    ]);
    expect(second.imported[0].mimeType).toBe('application/pdf');
  });

  it('keeps the extension when renaming and refuses duplicates', async () => {
    const { service } = setup();
    const { imported } = await service.importDocuments([src('a.pdf'), src('b.pdf')], null);
    const renamed = await service.renameDocument(imported[0].id, 'Póliza 2026');
    expect(renamed.name).toBe('Póliza 2026.pdf');
    await expect(service.renameDocument(imported[1].id, 'póliza 2026.pdf')).rejects.toBeInstanceOf(FolderNameError);
  });

  it('moves folders and documents and prevents cycles', async () => {
    const { service } = setup();
    const parent = await service.createFolder('Familia', null);
    const child = await service.createFolder('Hijos', parent.id);
    const { imported } = await service.importDocuments([src('libro.pdf')], null);
    await service.moveItems({ folderIds: [], documentIds: [imported[0].id] }, child.id);
    expect((await service.contents(child.id)).documents.map((d) => d.name)).toEqual(['libro.pdf']);
    await expect(service.moveFolder(parent.id, child.id)).rejects.toBeInstanceOf(FolderNameError);
  });

  it('deletes binaries with folders, but never drops a document whose file could not be deleted', async () => {
    const { service, files, failDeletes } = setup();
    const folder = await service.createFolder('Seguros', null);
    const sub = await service.createFolder('Coche', folder.id);
    const ok = await service.importDocuments([src('ok.pdf')], folder.id);
    const bad = await service.importDocuments([src('bad.pdf')], sub.id);
    failDeletes.add(bad.imported[0].storage.providerFileId);

    const result = await service.deleteFolders([folder.id]);
    expect(result).toEqual({ deleted: 1, failed: [bad.imported[0].id] });
    expect(files.has(ok.imported[0].storage.providerFileId)).toBe(false);
    // The failed document and its folder chain are kept.
    expect((await service.getDocument(bad.imported[0].id))?.name).toBe('bad.pdf');
    expect((await service.breadcrumb(sub.id)).map((f) => f.name)).toEqual(['Seguros', 'Coche']);
  });

  it('reports every file as unavailable when the active provider cannot initialise', async () => {
    const { service, provider } = setup();
    (provider.initialize as jest.Mock).mockRejectedValueOnce(new StorageProviderError('not-connected', 'google-drive'));
    const r = await service.importDocuments([src('x.pdf')], null);
    expect(r).toEqual({ imported: [], rejected: [{ name: 'x.pdf', reason: 'unavailable' }] });
  });
});
