import { createServices } from '@/services/container';
import { memoryStore } from '@/test/memoryStore';
import { buildDigest, digestText } from '../digest';
import { alertDocId } from '../firebaseNotify';

// jest.mock factories run lazily and must use require().
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
let mockId = 0;
jest.mock('@/utils/id', () => ({ createId: () => `id-${++mockId}` }));
jest.mock('@/services/backend/firebase', () => ({}));
jest.mock('firebase/firestore', () => ({}));

const t = (key: string, opts?: Record<string, unknown>) => (opts?.count !== undefined ? `${key}(${opts.count})` : key);

describe('daily summary', () => {
  it('collects the day: events, notes, tasks, "para mañana" and shopping', async () => {
    const s = createServices('u', memoryStore(), null);
    const cal = await s.calendars.createCalendar({ name: 'Elisa', color: '#f00' });
    await s.calendars.createEvent({
      calendarId: cal.id,
      title: 'Natación',
      allDay: false,
      startDate: '2026-10-09',
      startTime: '17:30',
      endDate: '2026-10-09',
      endTime: '18:30',
      location: 'Piscina',
    });
    await s.calendars.createEvent({ calendarId: cal.id, title: 'Otro día', allDay: true, startDate: '2026-10-10', endDate: '2026-10-10' });
    await s.calendars.addDayNote({ date: '2026-10-09', text: 'Llevar autorización', remindAt: '08:00' });
    await s.tasks.quickAdd({ title: 'Pagar comedor', dueDate: '2026-10-08' });
    await s.tasks.quickAdd({ title: 'Mañana no', dueDate: '2026-10-10' });
    await s.family.addItem('tomorrow', { title: 'Mochila', childId: null });
    const [list] = await s.shopping.listLists('Compra');
    await s.shopping.addItem({ listId: list.id, title: 'Leche', quantity: '2' });

    const d = await buildDigest(s, '2026-10-09', 'es', t);
    const byIcon = Object.fromEntries(d.sections.map((x) => [x.icon, x.lines]));
    expect(d.title).toMatch(/^[A-ZÁÉÍÓÚ]/);
    expect(byIcon['📅']).toEqual(['17:30 · Natación (Piscina) — Elisa']);
    expect(byIcon['📝']).toEqual(['08:00 · Llevar autorización']);
    expect(byIcon['✅']).toEqual(['remote.digest.overdue · Pagar comedor']);
    expect(byIcon['🎒']).toEqual(['Mochila']);
    expect(byIcon['🛒']).toEqual(['2 Leche']);
    expect(digestText(d, 'Tu día')).toContain('• 17:30 · Natación (Piscina) — Elisa');
  });

  it('says so when the day is empty', async () => {
    const s = createServices('u2', memoryStore(), null);
    await s.shopping.listLists('Compra');
    const d = await buildDigest(s, '2026-10-09', 'es', t);
    expect(d.sections).toEqual([]);
    expect(digestText(d, 'Tu día')).toContain('remote.digest.empty');
  });

  it('gives each alert a stable, Firestore-safe id', () => {
    const a = alertDocId('uid1', 'calendars:ev/1:2026-10-09:15');
    expect(a).toBe(alertDocId('uid1', 'calendars:ev/1:2026-10-09:15'));
    expect(a).toMatch(/^uid1_[a-z0-9]+$/);
    expect(a).not.toBe(alertDocId('uid1', 'calendars:ev/1:2026-10-09:30'));
  });
});
