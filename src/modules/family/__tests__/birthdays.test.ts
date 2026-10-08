import { nextBirthday, upcomingBirthdays } from '../selectors';
import type { Child } from '../types';

const child = (name: string, birthDate: string | null): Child => ({
  id: name,
  ownerId: 'u',
  createdAt: '',
  updatedAt: '',
  name,
  birthDate,
  color: '#000',
  activities: [],
});

describe('birthdays', () => {
  it('computes days until the next birthday and the age turned', () => {
    const b = nextBirthday(child('Elisa', '2021-03-14'), '2026-10-07')!;
    expect(b.turns).toBe(6);
    expect(b.date.getFullYear()).toBe(2027);
    expect(b.daysUntil).toBe(158);
  });

  it('treats a birthday today as 0 days', () => {
    expect(nextBirthday(child('Javi', '2019-10-07'), '2026-10-07')!.daysUntil).toBe(0);
  });

  it('maps 29 February to 28 February in non-leap years', () => {
    const b = nextBirthday(child('Leo', '2020-02-29'), '2026-10-07')!;
    expect(b.date.getMonth()).toBe(1);
    expect(b.date.getDate()).toBe(28);
  });

  it('lists only birthdays within the window, soonest first', () => {
    const list = upcomingBirthdays(
      [child('A', '2020-12-01'), child('B', '2020-10-20'), child('C', null), child('D', '2020-06-01')],
      '2026-10-07',
      90,
    );
    expect(list.map((b) => b.child.name)).toEqual(['B', 'A']);
  });
});
