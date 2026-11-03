import type { Repository } from '@/storage/repository';
import { matchScore, type SearchResult } from '@/types/search';
import type { DateKey } from '@/utils/date';
import type { Payment } from './types';

export interface PaymentInput {
  title: string;
  amount: number;
  everyMonths: number;
  startDate: DateKey;
  endDate?: DateKey | null;
  categoryId: string;
  notes?: string | null;
}

const cents = (n: number) => Math.round(n * 100) / 100;

function validate(input: Partial<PaymentInput>): void {
  if (input.title !== undefined && !input.title.trim()) throw new Error('Title is required');
  if (input.amount !== undefined && !(input.amount > 0)) throw new Error('Amount must be positive');
  if (input.everyMonths !== undefined && !(Number.isInteger(input.everyMonths) && input.everyMonths >= 0)) throw new Error('Bad frequency');
}

/** "Pagos": what the family has to pay, when, and what is already paid or saved. */
export class PaymentService {
  constructor(private readonly payments: Repository<Payment>) {}

  async list(): Promise<Payment[]> {
    return (await this.payments.list()).sort((a, b) => a.title.localeCompare(b.title));
  }

  get(id: string): Promise<Payment | null> {
    return this.payments.get(id);
  }

  async create(input: PaymentInput): Promise<Payment> {
    validate(input);
    return this.payments.create({
      title: input.title.trim(),
      amount: cents(input.amount),
      everyMonths: input.everyMonths,
      startDate: input.startDate,
      endDate: input.everyMonths ? (input.endDate ?? null) : null,
      categoryId: input.categoryId,
      notes: input.notes?.trim() || null,
      paidDates: [],
      saved: 0,
    });
  }

  async update(id: string, patch: Partial<PaymentInput>): Promise<Payment> {
    validate(patch);
    const p: Partial<Payment> = { ...patch };
    if (patch.title !== undefined) p.title = patch.title.trim();
    if (patch.amount !== undefined) p.amount = cents(patch.amount);
    if ('notes' in patch) p.notes = patch.notes?.trim() || null;
    if (patch.everyMonths === 0) p.endDate = null;
    return this.payments.update(id, p);
  }

  remove(id: string): Promise<void> {
    return this.payments.remove(id);
  }

  /** Marks one due date as paid; what was saved went into it. */
  async markPaid(id: string, date: DateKey): Promise<Payment> {
    const p = await this.payments.get(id);
    if (!p) throw new Error('Not found');
    if (p.paidDates.includes(date)) return p;
    return this.payments.update(id, { paidDates: [...p.paidDates, date].sort(), saved: 0, savedThisMonth: 0 });
  }

  async unmarkPaid(id: string, date: DateKey): Promise<Payment> {
    const p = await this.payments.get(id);
    if (!p) throw new Error('Not found');
    return this.payments.update(id, { paidDates: p.paidDates.filter((d) => d !== date) });
  }

  /** Adds (or, if negative, takes out) money set aside for the next due date, on `today`. */
  async addSaving(id: string, amount: number, today: DateKey): Promise<Payment> {
    const p = await this.payments.get(id);
    if (!p) throw new Error('Not found');
    const month = today.slice(0, 7);
    const before = p.savedMonth === month ? (p.savedThisMonth ?? 0) : 0;
    const saved = cents(Math.max(0, (p.saved || 0) + amount));
    return this.payments.update(id, {
      saved,
      savedMonth: month,
      savedThisMonth: cents(Math.min(saved, Math.max(0, before + amount))),
    });
  }

  async search(text: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    for (const p of await this.list()) {
      const score = matchScore(p.title, text);
      if (!score) continue;
      results.push({
        ref: { module: 'payments', type: 'payment', id: p.id },
        title: p.title,
        kindKey: 'search.kinds.payment',
        subtitle: `${p.amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`,
        score,
        route: `/payments?payment=${p.id}`,
      });
    }
    return results;
  }
}
