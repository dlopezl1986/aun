import { createServices } from '@/services/container';
import { memoryStore } from '@/test/memoryStore';
import { combine } from '@/utils/date';
import { dayNoteAlertSource } from '../alerts';

// jest.mock factories run lazily and must use require().
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
let mockId = 0;
jest.mock('@/utils/id', () => ({ createId: () => `id-${++mockId}` }));

const ctx = (from: Date, to: Date) => ({ from, to, t: (k: string) => k, locale: 'es' }) as never;

describe('day notes', () => {
  it('pins notes to days, edits, ticks and deletes them', async () => {
    const s = createServices('u', memoryStore(), null);
    await s.calendars.addDayNote({ date: '2026-10-09', text: '  Llevar autorización  ' });
    const b = await s.calendars.addDayNote({ date: '2026-10-10', text: 'Cumple abuela', color: '#F472B6', remindAt: '10:00' });
    await s.calendars.addDayNote({ date: '2026-10-20', text: 'Fuera de rango' });
    await expect(s.calendars.addDayNote({ date: '2026-10-09', text: '   ' })).rejects.toThrow();

    const week = await s.calendars.notesBetween('2026-10-09', '2026-10-15');
    expect(week.map((n) => [n.date, n.text])).toEqual([
      ['2026-10-09', 'Llevar autorización'],
      ['2026-10-10', 'Cumple abuela'],
    ]);

    await s.calendars.updateDayNote(b.id, { done: true, remindAt: '' });
    expect((await s.calendars.notesBetween('2026-10-10', '2026-10-10'))[0]).toMatchObject({ done: true, remindAt: null });
    await s.calendars.removeDayNote(b.id);
    expect(await s.calendars.notesBetween('2026-10-10', '2026-10-10')).toEqual([]);
    expect(s.collections.has('dayNotes')).toBe(true);
  });

  it('alerts at the chosen time only for pending notes with "Remind me"', async () => {
    const s = createServices('u', memoryStore(), null);
    await s.calendars.addDayNote({ date: '2026-10-09', text: 'Pediatra', remindAt: '10:00' });
    await s.calendars.addDayNote({ date: '2026-10-09', text: 'Sin aviso' });
    const done = await s.calendars.addDayNote({ date: '2026-10-09', text: 'Hecha', remindAt: '11:00' });
    await s.calendars.updateDayNote(done.id, { done: true });

    const alerts = await dayNoteAlertSource.list(s, ctx(combine('2026-10-09', '00:00'), combine('2026-10-09', '23:59')));
    expect(alerts.map((a) => [a.title, a.at, a.route])).toEqual([
      ['Pediatra', combine('2026-10-09', '10:00').toISOString(), '/calendars?day=2026-10-09'],
    ]);
  });

  it('is found by the global search and opens its day', async () => {
    const s = createServices('u', memoryStore(), null);
    await s.calendars.addDayNote({ date: '2026-10-09', text: 'Llamar al pediatra' });
    const results = await s.calendars.search('pediatra');
    expect(results).toEqual([expect.objectContaining({ title: 'Llamar al pediatra', route: '/calendars?day=2026-10-09' })]);
  });
});
