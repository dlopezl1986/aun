import { createServices } from '@/services/container';
import { memoryStore } from '@/test/memoryStore';
import { occurrenceColor } from '../types';

// jest.mock factories run lazily and must use require().
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
let mockId = 0;
jest.mock('@/utils/id', () => ({ createId: () => `id-${++mockId}` }));

describe('event colour', () => {
  it('fills with its own colour and falls back to the calendar colour', async () => {
    const s = createServices('u', memoryStore(), null);
    const cal = await s.calendars.createCalendar({ name: 'Soraya', color: '#EC4899' });
    const base = {
      calendarId: cal.id,
      allDay: false,
      startDate: '2026-10-12',
      startTime: '15:00',
      endDate: '2026-10-12',
      endTime: '23:00',
    };
    const shift = await s.calendars.createEvent({ ...base, title: 'Turno de tarde', color: '#8B5CF6' });
    const plain = await s.calendars.createEvent({ ...base, title: 'Dentista' });
    expect(shift.color).toBe('#8B5CF6');
    expect(plain.color).toBeNull();

    const occ = await s.calendars.occurrencesBetween(new Date(2026, 9, 12), new Date(2026, 9, 13));
    const byTitle = new Map(occ.map((o) => [o.event.title, occurrenceColor(o)]));
    expect(byTitle.get('Turno de tarde')).toBe('#8B5CF6');
    expect(byTitle.get('Dentista')).toBe('#EC4899');

    // Back to the calendar colour.
    await s.calendars.updateEvent(shift.id, { ...base, title: 'Turno de tarde', color: null });
    expect((await s.calendars.getEvent(shift.id))?.color).toBeNull();
  });
});
