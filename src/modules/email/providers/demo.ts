import type { KeyValueStore } from '@/storage/keyValueStore';
import { normalizeSearch } from '@/types/search';
import { createId } from '@/utils/id';
import {
  EmailError,
  type EmailAddress,
  type EmailConnection,
  type EmailFolder,
  type EmailMessage,
  type EmailProvider,
  type FolderRole,
  type MailContext,
  type MessagePage,
  type OutgoingEmail,
} from '../types';
import { htmlToText, quoteOriginal, replyAllCc } from './http';
import { prefixSubject } from './mime';

/**
 * DEVELOPMENT-ONLY demo mailbox. It is labelled as such in the UI, never
 * talks to the network and is not registered in production builds. It lets
 * QA exercise the whole mail UI (folders, read, send, reply, forward, trash,
 * search) without real Google/Microsoft credentials.
 */
export const DEMO_ADDRESS = 'demo@aun.local';

interface StoredMessage extends EmailMessage {
  folder: FolderRole;
}

const FOLDERS: { role: FolderRole; name: string }[] = [
  { role: 'inbox', name: 'Inbox' },
  { role: 'sent', name: 'Sent' },
  { role: 'trash', name: 'Trash' },
];

function seed(accountId: string, now = Date.now()): StoredMessage[] {
  const at = (hoursAgo: number) => new Date(now - hoursAgo * 3_600_000).toISOString();
  const base = { accountId, cc: [], attachments: [], hasAttachments: false, important: false, folder: 'inbox' as FolderRole };
  const me = [{ name: 'Demo', address: DEMO_ADDRESS }];
  return [
    {
      ...base,
      id: createId(),
      from: { name: 'Colegio San José', address: 'secretaria@colegio.example' },
      to: me,
      subject: 'Excursión al museo — autorización',
      snippet: 'Os recordamos que el viernes es la excursión. Hay que firmar la autorización.',
      bodyText:
        'Hola familias:\n\nOs recordamos que el viernes es la excursión al museo de ciencias. Hay que firmar la autorización y traer almuerzo.\n\nUn saludo,\nSecretaría',
      receivedAt: at(2),
      unread: true,
      important: true,
      hasAttachments: true,
      attachments: [{ name: 'autorizacion.pdf', mimeType: 'application/pdf', size: 48_213 }],
    },
    {
      ...base,
      id: createId(),
      from: { name: 'Centro de Salud', address: 'citas@salud.example' },
      to: me,
      subject: 'Recordatorio de cita: pediatría',
      snippet: 'Tiene una cita el próximo martes a las 9:30.',
      bodyText: 'Le recordamos su cita de pediatría el próximo martes a las 9:30. Si no puede asistir, anúlela con antelación.',
      receivedAt: at(20),
      unread: true,
    },
    {
      ...base,
      id: createId(),
      from: { name: 'Boletín AUN', address: 'news@newsletter.example' },
      to: me,
      subject: 'Ideas para organizar la semana',
      snippet: 'Cinco trucos para que el domingo por la tarde no sea un caos.',
      bodyHtml:
        '<h2 style="color:#5B5BD6">Organiza tu semana</h2><p>Cinco trucos para que el <b>domingo</b> no sea un caos.</p><img src="https://example.com/tracker.png" width="1" height="1"><ul><li>Revisa el calendario familiar</li><li>Prepara las mochilas</li></ul><script>alert("x")</script>',
      receivedAt: at(50),
      unread: false,
    },
    {
      ...base,
      id: createId(),
      from: { name: 'Laura', address: 'laura@example.com' },
      to: me,
      cc: [{ name: 'Abuela', address: 'abuela@example.com' }],
      subject: 'Cumpleaños de Elisa',
      snippet: '¿Reservamos el parque o lo hacemos en casa?',
      bodyText: '¿Reservamos el parque o lo hacemos en casa? Yo me encargo de la tarta.',
      receivedAt: at(75),
      unread: false,
    },
    {
      ...base,
      id: createId(),
      folder: 'sent',
      from: me[0],
      to: [{ name: 'Laura', address: 'laura@example.com' }],
      subject: 'Lista de la compra',
      snippet: 'Leche, pan, pañales y toallitas.',
      bodyText: 'Leche, pan, pañales y toallitas.',
      receivedAt: at(30),
      unread: false,
    },
  ];
}

export class DemoEmailProvider implements EmailProvider {
  readonly id = 'demo';

  constructor(
    private readonly store: KeyValueStore,
    private readonly userId: string,
  ) {}

  private key(accountId: string) {
    return `aun:v1:u:${this.userId}:demoMail:${accountId}`;
  }

  private async load(ctx: MailContext): Promise<StoredMessage[]> {
    const raw = await this.store.getItem(this.key(ctx.accountId));
    if (raw) return JSON.parse(raw) as StoredMessage[];
    const seeded = seed(ctx.accountId);
    await this.save(ctx, seeded);
    return seeded;
  }

  private save(ctx: MailContext, messages: StoredMessage[]) {
    return this.store.setItem(this.key(ctx.accountId), JSON.stringify(messages));
  }

  private async mutate(ctx: MailContext, id: string, fn: (m: StoredMessage) => void) {
    const all = await this.load(ctx);
    const m = all.find((x) => x.id === id);
    if (!m) throw new EmailError('not-found');
    fn(m);
    await this.save(ctx, all);
  }

  support() {
    return { supported: true } as const;
  }

  async connect(): Promise<EmailConnection> {
    return { address: DEMO_ADDRESS, label: 'Demo', tokens: { accessToken: 'demo', expiresAt: Number.MAX_SAFE_INTEGER } };
  }

  async refresh(tokens: EmailConnection['tokens']) {
    return tokens;
  }

  async revoke() {
    // Nothing to revoke.
  }

  async listFolders(ctx: MailContext): Promise<EmailFolder[]> {
    const all = await this.load(ctx);
    return FOLDERS.map((f) => ({
      id: f.role,
      name: f.name,
      role: f.role,
      unread: all.filter((m) => m.folder === f.role && m.unread).length,
    }));
  }

  async listMessages(ctx: MailContext, folderId: string): Promise<MessagePage> {
    const all = await this.load(ctx);
    return { items: all.filter((m) => m.folder === folderId).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)) };
  }

  async search(ctx: MailContext, query: string): Promise<MessagePage> {
    const q = normalizeSearch(query);
    const all = await this.load(ctx);
    const hit = (m: StoredMessage) =>
      [m.subject, m.from.name ?? '', m.from.address, m.bodyText ?? '', m.bodyHtml ? htmlToText(m.bodyHtml) : ''].some((v) =>
        normalizeSearch(v).includes(q),
      );
    return { items: all.filter((m) => m.folder !== 'trash' && hit(m)).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)) };
  }

  async getMessage(ctx: MailContext, messageId: string): Promise<EmailMessage> {
    const m = (await this.load(ctx)).find((x) => x.id === messageId);
    if (!m) throw new EmailError('not-found');
    return { ...m, bodyText: m.bodyText ?? (m.bodyHtml ? htmlToText(m.bodyHtml) : '') };
  }

  private async deliver(ctx: MailContext, to: EmailAddress[], cc: EmailAddress[], subject: string, body: string) {
    const all = await this.load(ctx);
    const message: StoredMessage = {
      id: createId(),
      accountId: ctx.accountId,
      folder: 'sent',
      from: { name: 'Demo', address: ctx.address },
      to,
      cc,
      subject,
      snippet: body.slice(0, 120),
      bodyText: body,
      receivedAt: new Date().toISOString(),
      unread: false,
      important: false,
      hasAttachments: false,
      attachments: [],
    };
    all.push(message);
    // Mail sent to the demo address itself arrives in the inbox.
    if ([...to, ...cc].some((a) => a.address.toLowerCase() === ctx.address))
      all.push({ ...message, id: createId(), folder: 'inbox', unread: true });
    await this.save(ctx, all);
  }

  send(ctx: MailContext, m: OutgoingEmail) {
    return this.deliver(ctx, m.to, m.cc ?? [], m.subject, m.body);
  }

  reply(ctx: MailContext, original: EmailMessage, body: string, replyAll: boolean) {
    const quoted = quoteOriginal(`${original.from.address}:`, original.bodyText ?? '');
    return this.deliver(
      ctx,
      [original.from],
      replyAll ? replyAllCc(original, ctx.address) : [],
      prefixSubject('Re', original.subject),
      body + quoted,
    );
  }

  forward(ctx: MailContext, original: EmailMessage, to: EmailAddress[], body: string) {
    const quoted = quoteOriginal(`---------- ${original.from.address} · ${original.subject}`, original.bodyText ?? '');
    return this.deliver(ctx, to, [], prefixSubject('Fwd', original.subject), body + quoted);
  }

  delete(ctx: MailContext, messageId: string) {
    return this.mutate(ctx, messageId, (m) => {
      m.folder = 'trash';
    });
  }

  markRead(ctx: MailContext, messageId: string, read: boolean) {
    return this.mutate(ctx, messageId, (m) => {
      m.unread = !read;
    });
  }

  markImportant(ctx: MailContext, messageId: string, important: boolean) {
    return this.mutate(ctx, messageId, (m) => {
      m.important = important;
    });
  }
}
