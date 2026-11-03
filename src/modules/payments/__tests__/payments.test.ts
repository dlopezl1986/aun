import { LocalRepository } from '@/storage/repository';
import { memoryStore } from '@/test/memoryStore';
import {
  addMonthsKey,
  monthlyAverage,
  monthlySaving,
  monthSummary,
  nextUnpaid,
  occurrencesBetween,
  overdue,
  parseAmount,
  paymentCount,
  savingPlan,
} from '../schedule';
import { PaymentService } from '../service';
import type { Payment } from '../types';

// jest.mock factories run lazily and must use require().
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
let mockId = 0;
jest.mock('@/utils/id', () => ({ createId: () => `id-${++mockId}` }));

const pay = (p: Partial<Payment>): Payment => ({
  id: p.title ?? 'x',
  ownerId: 'u',
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z',
  title: 'x',
  amount: 100,
  everyMonths: 0,
  startDate: '2026-01-10',
  endDate: null,
  categoryId: 'other',
  paidDates: [],
  saved: 0,
  ...p,
});

describe('schedule', () => {
  it('keeps the day of the month, using the last day of shorter months', () => {
    expect(addMonthsKey('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsKey('2026-01-31', 2)).toBe('2026-03-31');
    expect(addMonthsKey('2026-11-15', 3)).toBe('2027-02-15');
    expect(addMonthsKey('2026-02-15', -3)).toBe('2025-11-15');
    const rent = pay({ title: 'Alquiler', everyMonths: 1, startDate: '2026-01-31' });
    expect(occurrencesBetween(rent, '2026-02-01', '2026-04-30').map((o) => o.date)).toEqual(['2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('counts the payments of a series with an end date', () => {
    expect(paymentCount(pay({ everyMonths: 0 }))).toBe(1);
    expect(paymentCount(pay({ everyMonths: 1 }))).toBeNull();
    expect(paymentCount(pay({ everyMonths: 1, startDate: '2026-09-05', endDate: '2027-06-05' }))).toBe(10);
    expect(paymentCount(pay({ everyMonths: 3, startDate: '2026-01-31', endDate: '2026-10-30' }))).toBe(3);
    const comedor = pay({ title: 'Comedor', everyMonths: 1, startDate: '2026-09-05', endDate: '2027-06-05' });
    const all = occurrencesBetween(comedor, '2026-01-01', '2028-01-01');
    expect(all).toHaveLength(10);
    expect(all[9]).toMatchObject({ date: '2027-06-05', index: 9, total: 10 });
  });

  it('ignores due dates before a recurring payment was added, but not a one-off in the past', () => {
    const gym = pay({ title: 'Gimnasio', everyMonths: 1, startDate: '2025-06-01', createdAt: '2026-11-03T09:00:00.000Z' });
    expect(overdue([gym], '2026-11-03')).toEqual([]);
    expect(nextUnpaid(gym, '2026-11-03')?.date).toBe('2026-12-01');
    const itv = pay({ title: 'ITV', startDate: '2026-10-20' });
    expect(overdue([itv], '2026-11-03').map((o) => o.payment.title)).toEqual(['ITV']);
  });

  it('sums what falls due this month and what is paid', () => {
    const rent = pay({ title: 'Alquiler', amount: 800, everyMonths: 1, startDate: '2026-01-01', paidDates: ['2026-11-01'] });
    const ibi = pay({ title: 'IBI', amount: 350.5, startDate: '2026-11-20' });
    expect(monthSummary([rent, ibi], '2026-11-03')).toEqual({ total: 1150.5, paid: 800, count: 2, paidCount: 1 });
  });

  it('splits big payments over the months left, minus what is saved', () => {
    const insurance = pay({ title: 'Seguro coche', amount: 600, everyMonths: 12, startDate: '2027-03-15', saved: 150 });
    const school = pay({ title: 'Matrícula', amount: 300, startDate: '2026-11-25' });
    const rent = pay({ title: 'Alquiler', amount: 800, everyMonths: 1, startDate: '2026-01-01' });
    const plan = savingPlan([insurance, school, rent], '2026-11-03');
    expect(plan.map((g) => [g.payment.title, g.months, g.perMonth])).toEqual([
      ['Matrícula', 0, 300],
      ['Seguro coche', 4, 112.5],
    ]);
    expect(monthlySaving(plan)).toBe(112.5);
    expect(monthlyAverage([insurance, rent], '2026-11-03')).toBe(850);
  });

  it('keeps the monthly quota after saving part of it this month', () => {
    const light = pay({
      title: 'Luz',
      amount: 75,
      everyMonths: 2,
      startDate: '2027-01-01',
      saved: 20,
      savedMonth: '2026-11',
      savedThisMonth: 20,
    });
    const [g] = savingPlan([light], '2026-11-03');
    expect(g).toMatchObject({ months: 2, perMonth: 37.5, leftThisMonth: 17.5, remaining: 55 });
    // Next month the quota is what is left over the months left.
    const [later] = savingPlan([{ ...light, saved: 37.5, savedThisMonth: 37.5 }], '2026-12-02');
    expect(later).toMatchObject({ months: 1, perMonth: 37.5, leftThisMonth: 37.5 });
  });

  it('reads amounts the Spanish way', () => {
    expect(parseAmount('12,50')).toBe(12.5);
    expect(parseAmount('1.200')).toBe(1200);
    expect(parseAmount('1.200,75 €')).toBe(1200.75);
    expect(parseAmount('12.5')).toBe(12.5);
    expect(parseAmount('0')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });
});

describe('PaymentService', () => {
  const setup = () => new PaymentService(new LocalRepository<Payment>(memoryStore(), 'u', 'payments'));

  it('creates, marks paid (using up the savings) and unmarks', async () => {
    const s = setup();
    const p = await s.create({
      title: ' Seguro hogar ',
      amount: 240.456,
      everyMonths: 12,
      startDate: '2027-02-01',
      categoryId: 'insurance',
    });
    expect(p).toMatchObject({ title: 'Seguro hogar', amount: 240.46, paidDates: [], saved: 0, endDate: null });
    expect(await s.addSaving(p.id, 100, '2026-11-03')).toMatchObject({ saved: 100, savedMonth: '2026-11', savedThisMonth: 100 });
    expect(await s.addSaving(p.id, -150, '2026-11-03')).toMatchObject({ saved: 0, savedThisMonth: 0 });
    expect((await s.addSaving(p.id, 50, '2026-12-01')).savedThisMonth).toBe(50);
    const paid = await s.markPaid(p.id, '2027-02-01');
    expect(paid).toMatchObject({ paidDates: ['2027-02-01'], saved: 0, savedThisMonth: 0 });
    expect((await s.unmarkPaid(p.id, '2027-02-01')).paidDates).toEqual([]);
  });

  it('rejects empty titles and non-positive amounts', async () => {
    const s = setup();
    await expect(s.create({ title: ' ', amount: 1, everyMonths: 0, startDate: '2026-11-03', categoryId: 'other' })).rejects.toThrow();
    await expect(s.create({ title: 'A', amount: 0, everyMonths: 0, startDate: '2026-11-03', categoryId: 'other' })).rejects.toThrow();
  });
});
