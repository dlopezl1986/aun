import { firstMatchingDay } from '@/services/bridges/memberCalendarBridge';
import { createServices } from '@/services/container';
import { memoryStore } from '@/test/memoryStore';
import { normalizeMember } from '../service';
import type { Child } from '../types';

// jest.mock factories run lazily and must use require().
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
let mockId = 0;
jest.mock('@/utils/id', () => ({ createId: () => `id-${++mockId}` }));

describe('family members ⇄ calendars', () => {
  it('creates a calendar per member and keeps it in sync with name/colour; archives it on removal', async () => {
    const s = createServices('u', memoryStore(), null);
    const laura = await s.family.createChild({
      name: 'Laura',
      color: '#DB2777',
      relation: 'partner',
      sizes: [{ key: 'shoes', value: ' 38 ' }],
    });
    expect(laura.relation).toBe('partner');
    expect(laura.sizes).toEqual([{ key: 'shoes', value: '38' }]);
    const cal = (await s.calendars.listCalendars()).find((c) => c.id === laura.calendarId);
    expect(cal).toMatchObject({ name: 'Laura', color: '#DB2777', isActive: true });

    await s.family.updateChild(laura.id, { name: 'Laura M.', color: '#7C3AED' });
    expect((await s.calendars.listCalendars()).find((c) => c.id === laura.calendarId)).toMatchObject({
      name: 'Laura M.',
      color: '#7C3AED',
    });

    await s.family.removeChild(laura.id);
    expect((await s.calendars.listCalendars()).find((c) => c.id === laura.calendarId)?.isActive).toBe(false);
  });

  it('turns scheduled activities into weekly events in the member calendar', async () => {
    const s = createServices('u', memoryStore(), null);
    const elisa = await s.family.createChild({ name: 'Elisa', color: '#EA580C' });
    let m = await s.family.saveActivities(elisa.id, [
      { name: 'Fútbol', weekdays: [1, 3], startTime: '17:30', endTime: '18:30', place: 'Polideportivo' },
      { name: 'Leer', weekdays: [] },
    ]);
    const football = m.activities.find((a) => a.name === 'Fútbol')!;
    expect(m.activities.find((a) => a.name === 'Leer')?.eventId).toBeNull();
    const event = await s.calendars.getEvent(football.eventId!);
    expect(event).toMatchObject({ calendarId: elisa.calendarId, title: 'Fútbol', location: 'Polideportivo' });
    expect(event?.recurrence).toMatchObject({ freq: 'weekly', byWeekday: [1, 3] });
    // Linked back to the member: shows on her profile.
    expect(await s.calendars.eventsLinkedTo({ module: 'family', type: 'child', id: elisa.id })).toHaveLength(1);

    // Editing the activity updates the same event; removing it deletes the event.
    m = await s.family.saveActivities(elisa.id, [{ id: football.id, name: 'Fútbol', weekdays: [4], startTime: '10:00' }]);
    expect(m.activities[0].eventId).toBe(football.eventId);
    expect((await s.calendars.getEvent(football.eventId!))?.recurrence?.byWeekday).toEqual([4]);
    await s.family.saveActivities(elisa.id, []);
    expect(await s.calendars.getEvent(football.eventId!)).toBeNull();
  });

  it('gives a calendar to members created before calendars existed and reads old activity names', async () => {
    const kv = memoryStore();
    const s = createServices('u', kv, null);
    const legacy = { name: 'Javi', color: '#00f', activities: ['Natación'] } as unknown as Child;
    await s.collections.get('children')!.importRows([{ ...legacy, id: 'old', ownerId: 'u', createdAt: 'x', updatedAt: 'x' } as never]);
    const [javi] = await s.family.listChildren();
    expect(javi.calendarId).toBeTruthy();
    expect(javi.relation).toBe('child');
    expect(javi.activities).toEqual([{ id: 'legacy-0', name: 'Natación', weekdays: [] }]);
    expect(normalizeMember({ ...legacy, activities: [] } as Child).sizes).toEqual([]);
  });

  it('never creates two calendars for one member, even with concurrent loads from two instances', async () => {
    const kv = memoryStore();
    const a = createServices('u', kv, null);
    const b = createServices('u', kv, null);
    const legacy = { name: 'Elisa', color: '#f0f', activities: [] } as unknown as Child;
    await a.collections.get('children')!.importRows([{ ...legacy, id: 'e', ownerId: 'u', createdAt: 'x', updatedAt: 'x' } as never]);
    const [r1, r2, r3] = await Promise.all([a.family.listChildren(), b.family.listChildren(), a.family.listChildren()]);
    expect(new Set([r1[0].calendarId, r2[0].calendarId, r3[0].calendarId]).size).toBe(1);
    expect((await a.calendars.listCalendars()).filter((c) => c.name === 'Elisa')).toHaveLength(1);
  });

  it('uses an existing calendar when assigned, and leaves it as it is', async () => {
    const s = createServices('u', memoryStore(), null);
    const work = await s.calendars.createCalendar({ name: 'Turnos Soraya', color: '#8B5CF6' });
    const before = (await s.calendars.listCalendars()).length;
    const soraya = await s.family.createChild({ name: 'Soraya', color: '#EC4899', relation: 'partner', calendarId: work.id });
    expect(soraya.calendarId).toBe(work.id);
    expect((await s.calendars.listCalendars()).length).toBe(before); // no extra calendar
    // Renaming / recolouring the member does not touch an assigned calendar…
    await s.family.updateChild(soraya.id, { name: 'Sora', color: '#000000' });
    expect((await s.calendars.listCalendars()).find((c) => c.id === work.id)).toMatchObject({ name: 'Turnos Soraya', color: '#8B5CF6' });
    // …and removing the member keeps it active.
    await s.family.removeChild(soraya.id);
    expect((await s.calendars.listCalendars()).find((c) => c.id === work.id)?.isActive).toBe(true);
  });

  it('can switch a member to another existing calendar', async () => {
    const s = createServices('u', memoryStore(), null);
    const javi = await s.family.createChild({ name: 'Javi', color: '#16A34A' });
    const school = await s.calendars.createCalendar({ name: 'Cole Javi', color: '#F59E0B' });
    const updated = await s.family.updateChild(javi.id, { calendarId: school.id });
    expect(updated).toMatchObject({ calendarId: school.id, calendarLinked: true });
  });

  it('starts weekly activities on the first matching day', () => {
    // 2026-10-08 is a Thursday (index 3).
    expect(firstMatchingDay([3], new Date('2026-10-08T12:00:00'))).toBe('2026-10-08');
    expect(firstMatchingDay([0], new Date('2026-10-08T12:00:00'))).toBe('2026-10-12');
  });
});
