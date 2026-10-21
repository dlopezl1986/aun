import { createServices } from '@/services/container';
import { memoryStore } from '@/test/memoryStore';
import { hoursPerTopic, opTotals } from '../service';

// jest.mock factories run lazily and must use require().
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
let mockId = 0;
jest.mock('@/utils/id', () => ({ createId: () => `id-${++mockId}` }));

const look = { name: 'Oposición', color: '#4C1D95' };

async function setup() {
  const s = createServices('u', memoryStore(), null);
  await s.op.addTopicRange(1, 6);
  const t = Object.fromEntries((await s.op.listTopics()).map((x) => [x.number, x.id]));
  const eventsOn = async (date: string) =>
    (await s.calendars.occurrencesBetween(new Date(`${date}T00:00`), new Date(`${date}T23:59`))).map(
      (o) => `${o.calendar.name}:${o.event.title}`,
    );
  return { s, t, eventsOn };
}

describe('OP (oposición)', () => {
  it('the syllabus: topics 1 to N in order, no duplicates', async () => {
    const { s } = await setup();
    expect(await s.op.addTopicRange(4, 8)).toBe(2);
    expect((await s.op.listTopics()).map((x) => x.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('planning a day with topics 1, 2 and 5 creates the study day and shows it in the "Oposición" calendar', async () => {
    const { s, t, eventsOn } = await setup();
    expect(await s.op.planDay('2026-11-02', [t[1], t[2], t[5]], look)).toBe('created');
    expect(await eventsOn('2026-11-02')).toEqual(['Oposición:OP · T1, T2, T5']);
    // The same calendar is reused for every day.
    await s.op.planDay('2026-11-03', [t[3]], look);
    expect((await s.calendars.listCalendars()).filter((c) => c.purpose === 'op')).toHaveLength(1);
  });

  it('tapping again with the same topics takes them off (and removes an empty day); other topics are added', async () => {
    const { s, t, eventsOn } = await setup();
    await s.op.planDay('2026-11-02', [t[1]], look);
    expect(await s.op.planDay('2026-11-02', [t[2]], look)).toBe('updated');
    expect(await eventsOn('2026-11-02')).toEqual(['Oposición:OP · T1, T2']);
    expect(await s.op.planDay('2026-11-02', [t[1], t[2]], look)).toBe('removed');
    expect(await s.op.sessionOn('2026-11-02')).toBeNull();
    expect(await eventsOn('2026-11-02')).toEqual([]);
  });

  it('a day with hours or notes is never removed by tapping', async () => {
    const { s, t } = await setup();
    await s.op.planDay('2026-11-02', [t[1]], look);
    const day = (await s.op.sessionOn('2026-11-02'))!;
    await s.op.updateSession(day.id, { hours: 2.5, notes: 'Bien' }, look);
    await s.op.planDay('2026-11-02', [t[1]], look);
    expect(await s.op.sessionOn('2026-11-02')).toMatchObject({ topicIds: [], hours: 2.5, notes: 'Bien' });
  });

  it('what was left behind and the notes for tomorrow show up on the next study day', async () => {
    const { s, t } = await setup();
    await s.op.planDay('2026-11-02', [t[1]], look);
    await s.op.planDay('2026-11-04', [t[2]], look);
    const mon = (await s.op.sessionOn('2026-11-02'))!;
    await s.op.updateSession(mon.id, { behind: 'Me falta el apartado 3', tomorrow: 'Repasar esquemas' }, look);
    expect(await s.op.carriedNotes('2026-11-04')).toMatchObject({ date: '2026-11-02', behind: 'Me falta el apartado 3' });
    expect(await s.op.carriedNotes('2026-11-02')).toBeNull();
  });

  it('hours: today, this week, this month, total and (approximately) per topic', async () => {
    const { s, t } = await setup();
    await s.op.planDay('2026-11-02', [t[1], t[2]], look); // Monday
    await s.op.planDay('2026-11-04', [t[1]], look);
    await s.op.planDay('2026-10-30', [t[3]], look);
    for (const [date, hours] of [
      ['2026-11-02', 3],
      ['2026-11-04', 2.5],
      ['2026-10-30', 1],
    ] as const)
      await s.op.updateSession((await s.op.sessionOn(date))!.id, { hours }, look);
    const sessions = await s.op.listSessions();
    expect(opTotals(sessions, '2026-11-04')).toEqual({ today: 2.5, week: 5.5, month: 5.5, total: 6.5 });
    const per = hoursPerTopic(sessions);
    expect(per.get(t[1])).toBe(4); // 1.5 + 2.5
    expect(per.get(t[2])).toBe(1.5);
  });

  it('removing a topic takes it out of the study days and their calendar events', async () => {
    const { s, t, eventsOn } = await setup();
    await s.op.planDay('2026-11-02', [t[1], t[2]], look);
    await s.op.removeTopic(t[2], look);
    expect(await eventsOn('2026-11-02')).toEqual(['Oposición:OP · T1']);
  });

  it('the syllabus 1 to 45 without 36 and 37', async () => {
    const s = createServices('u', memoryStore(), null);
    const numbers = Array.from({ length: 45 }, (_, i) => i + 1).filter((n) => n !== 36 && n !== 37);
    expect(await s.op.addTopics(numbers)).toBe(43);
    const have = (await s.op.listTopics()).map((x) => x.number);
    expect(have).toHaveLength(43);
    expect(have).not.toContain(36);
    expect(have).not.toContain(37);
    expect(await s.op.addTopics([1, 2, 46])).toBe(1);
  });

  it('setDay creates, changes and removes a day (never one with something written)', async () => {
    const { s, t, eventsOn } = await setup();
    expect(await s.op.setDay('2026-11-05', { notes: '' }, look)).toBeNull();
    await s.op.setDay('2026-11-05', { topicIds: [t[3]] }, look);
    expect(await eventsOn('2026-11-05')).toEqual(['Oposición:OP · T3']);
    await s.op.setDay('2026-11-05', { hours: 1.5 }, look);
    expect((await s.op.setDay('2026-11-05', { topicIds: [] }, look))?.hours).toBe(1.5);
    await s.op.setDay('2026-11-05', { hours: 0 }, look);
    expect(await s.op.sessionOn('2026-11-05')).toBeNull();
    expect(await eventsOn('2026-11-05')).toEqual([]);
  });
});
