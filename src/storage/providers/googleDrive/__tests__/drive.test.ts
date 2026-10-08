import { StorageProviderError } from '../../errors';
import { GoogleDriveStorageProvider } from '../GoogleDriveStorageProvider';

const mockGetToken = jest.fn(async (_user: string, force?: boolean) => (force ? 'fresh-token' : 'old-token'));

jest.mock('@/services/oauth/googleOAuth', () => ({
  getGoogleAccessToken: (user: string, force?: boolean) => mockGetToken(user, force),
  getGoogleConnection: async () => ({ connected: true, email: 'david@gmail.com' }),
  connectGoogleDrive: jest.fn(),
  disconnectGoogleDrive: jest.fn(async () => undefined),
}));
jest.mock('../transfer', () => ({
  uploadToDrive: jest.fn(async (_t: string, s: { name: string }, parent: string) => ({
    id: 'f1',
    name: s.name,
    mimeType: 'application/pdf',
    size: '42',
    parents: [parent],
  })),
  downloadFromDrive: jest.fn(async () => ({ uri: 'file://cache/f1.pdf' })),
  forgetCachedCopy: jest.fn(),
}));

type Call = { url: string; method: string; auth?: string; body?: string };
const calls: Call[] = [];

/** Tiny fake of the Drive REST API. */
function mockDrive(handler: (c: Call) => { status: number; json?: unknown }) {
  globalThis.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const call = { url: String(url), method: init?.method ?? 'GET', auth: headers.Authorization, body: init?.body as string | undefined };
    calls.push(call);
    const { status, json } = handler(call);
    return { ok: status >= 200 && status < 300, status, json: async () => json } as Response;
  }) as typeof fetch;
}

beforeEach(() => {
  calls.length = 0;
  mockGetToken.mockClear();
});

describe('GoogleDriveStorageProvider', () => {
  it('creates the AUN root folder once and uploads into it', async () => {
    mockDrive((c) => {
      if (c.method === 'GET' && c.url.includes('/files?q=')) return { status: 200, json: { files: [] } };
      if (c.method === 'POST')
        return { status: 200, json: { id: 'root-aun', name: 'AUN', mimeType: 'application/vnd.google-apps.folder' } };
      return { status: 500 };
    });
    const drive = new GoogleDriveStorageProvider('u1');
    const meta = await drive.uploadFile({ uri: 'file://a.pdf', name: 'a.pdf', mimeType: 'application/pdf' }, null);
    expect(meta).toMatchObject({ providerId: 'google-drive', providerFileId: 'f1', size: 42, parentId: 'root-aun' });
    await drive.uploadFile({ uri: 'file://b.pdf', name: 'b.pdf', mimeType: 'application/pdf' }, null);
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1); // root cached
    expect(decodeURIComponent(calls[0].url)).toContain("name='AUN'");
  });

  it('retries once with a refreshed token on 401', async () => {
    mockDrive((c) =>
      c.auth === 'Bearer old-token'
        ? { status: 401, json: {} }
        : { status: 200, json: { id: 'f1', name: 'Nuevo.pdf', mimeType: 'application/pdf' } },
    );
    const drive = new GoogleDriveStorageProvider('u1');
    const meta = await drive.renameFile({ providerId: 'google-drive', providerFileId: 'f1' }, 'Nuevo.pdf');
    expect(meta.name).toBe('Nuevo.pdf');
    expect(calls.map((c) => c.auth)).toEqual(['Bearer old-token', 'Bearer fresh-token']);
  });

  it('moves deleted files to the Drive trash instead of hard-deleting', async () => {
    mockDrive(() => ({ status: 200, json: {} }));
    await new GoogleDriveStorageProvider('u1').deleteFile({ providerId: 'google-drive', providerFileId: 'f9' });
    expect(calls[0]).toMatchObject({ method: 'PATCH', body: JSON.stringify({ trashed: true }) });
    expect(calls[0].url).toContain('/files/f9');
  });

  it('maps quota and not-found errors', async () => {
    mockDrive((c) =>
      c.url.includes('quota')
        ? { status: 403, json: { error: { errors: [{ reason: 'storageQuotaExceeded' }] } } }
        : { status: 404, json: { error: { message: 'File not found' } } },
    );
    const drive = new GoogleDriveStorageProvider('u1');
    await expect(drive.getFileMetadata({ providerId: 'google-drive', providerFileId: 'missing' })).rejects.toMatchObject({
      code: 'not-found',
    });
    await expect(drive.getFileMetadata({ providerId: 'google-drive', providerFileId: 'quota' })).rejects.toBeInstanceOf(
      StorageProviderError,
    );
    await expect(drive.getFileMetadata({ providerId: 'google-drive', providerFileId: 'quota' })).rejects.toMatchObject({ code: 'quota' });
  });
});
