import { eventAlertSource } from '@/modules/calendars/alerts';
import { birthdayAlertSource, tomorrowAlertSource } from '@/modules/family/alerts';
import { reminderAlertSource } from '@/modules/notifications/alerts';
import { nextReminderTime } from '@/modules/notifications/service';
import { taskAlertSource } from '@/modules/todo/alerts';
import { createServices } from '@/services/container';
import { memoryStore } from '@/test/memoryStore';
import type { AlertContext, AppModule } from '@/types/module';
import { collectAlerts } from '../alerts';

// jest.mock factories run lazily and must use require().
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/utils/id', () => {
  let i = 0;
  return { createId: () => `id-${++i}` };
});

const t = (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k);
const ctx = (from: string, to: string): AlertContext => ({
  from: new Date(from),
  to: new Date(to),
  t,
  locale: 'es',
  tomorrowTime: '20:00',
});

describe('alert sources', () => {
  it('calendar: every occurrence of a recurring event alerts N minutes before', async () => {
    const s = createServices('u', memoryStore());
    const cal = await s.calendars.createCalendar({ name: 'Familia', color: '#f00' });
    await s.calendars.createEvent({
      calendarId: cal.id,
      title: 'Fútbol',
      allDay: false,
      startDate: '2026-10-08',
      startTime: '17:00',
      endDate: '2026-10-08',
      endTime: '18:00',
      reminders: [15],
      recurrence: { freq: 'weekly', interval: 1, byWeekday: [3] },
    } as never);
    const alerts = await eventAlertSource.list(s, ctx('2026-10-07T00:00:00', '2026-10-21T23:59:59'));
    expect(alerts.map((a) => new Date(a.at).toLocaleString('sv'))).toEqual(['2026-10-08 16:45:00', '2026-10-15 16:45:00']);
    expect(alerts[0].route).toMatch(/^\/calendars\?event=/);
  });

  it('todo: reminders relative to due time (09:00 without time) and deadlines; done tasks are silent', async () => {
    const s = createServices('u', memoryStore());
    const a = await s.tasks.quickAdd({ title: 'Llamar al pediatra', dueDate: '2026-10-08', dueTime: '10:30' });
    await s.tasks.update(a.id, { reminders: [30] });
    const b = await s.tasks.quickAdd({ title: 'Renovar DNI', dueDate: '2026-10-09' });
    await s.tasks.update(b.id, { reminders: [0], deadline: '2026-10-10' });
    const c = await s.tasks.quickAdd({ title: 'Hecha', dueDate: '2026-10-08' });
    await s.tasks.update(c.id, { reminders: [0] });
    await s.tasks.toggleComplete((await s.tasks.get(c.id))!);
    const alerts = await taskAlertSource.list(s, ctx('2026-10-07T00:00:00', '2026-10-12T00:00:00'));
    expect(alerts.map((x) => [x.title, new Date(x.at).toLocaleString('sv')])).toEqual(
      expect.arrayContaining([
        ['Llamar al pediatra', '2026-10-08 10:00:00'],
        ['Renovar DNI', '2026-10-09 09:00:00'],
        ['Renovar DNI', '2026-10-10 09:00:00'],
      ]),
    );
    expect(alerts.some((x) => x.title === 'Hecha')).toBe(false);
  });

  it('family: evening "para mañana" only with pending items, and birthdays', async () => {
    const s = createServices('u', memoryStore());
    const window = ctx('2026-10-07T00:00:00', '2026-10-07T23:59:59');
    expect(await tomorrowAlertSource.list(s, window)).toEqual([]);
    const elisa = await s.family.createChild({ name: 'Elisa', color: '#f0f', birthDate: '2021-10-08' });
    await s.family.addItem('tomorrow', { title: 'Mochila', childId: elisa.id, routine: true });
    const evening = await tomorrowAlertSource.list(s, window);
    expect(evening).toHaveLength(1);
    expect(new Date(evening[0].at).toLocaleString('sv')).toBe('2026-10-07 20:00:00');
    expect(evening[0].body).toContain('Mochila (Elisa)');
    const birthdays = await birthdayAlertSource.list(s, ctx('2026-10-07T00:00:00', '2026-10-09T00:00:00'));
    expect(birthdays.map((b) => new Date(b.at).toLocaleString('sv'))).toEqual(['2026-10-07 20:00:00', '2026-10-08 09:00:00']);
    expect(birthdays[1].title).toContain('"count":5');
  });

  it('manual reminders: recurring ones expand; completing jumps to the next occurrence', async () => {
    const s = createServices('u', memoryStore());
    const r = await s.notifications.createReminder({
      title: 'Sacar la basura',
      date: '2026-10-07',
      time: '21:00',
      recurrence: { freq: 'daily', interval: 1 },
    });
    const alerts = await reminderAlertSource.list(s, ctx('2026-10-07T00:00:00', '2026-10-09T23:59:59'));
    expect(alerts).toHaveLength(3);
    const done = await s.notifications.completeReminder(r, new Date('2026-10-07T21:05:00'));
    expect(new Date(done.next!).toLocaleString('sv')).toBe('2026-10-08 21:00:00');
    expect(done.reminder.done).toBe(false);
    const once = await s.notifications.createReminder({ title: 'Regalo', date: '2026-10-09', time: '18:00' });
    expect((await s.notifications.completeReminder(once)).reminder.done).toBe(true);
    expect(nextReminderTime({ at: '2026-10-07T19:00:00.000Z', recurrence: null }, new Date())).toBeNull();
  });

  it('collectAlerts skips disabled modules/sources and survives a failing source', async () => {
    const s = createServices('u', memoryStore());
    await s.notifications.createReminder({ title: 'A', date: '2026-10-07', time: '10:00' });
    const boom: AppModule = {
      id: 'boom',
      alerts: [{ id: 'boom.x', labelKey: '', descriptionKey: '', icon: 'x', list: async () => Promise.reject(new Error('x')) }],
    } as unknown as AppModule;
    const notif = { id: 'notifications', alerts: [reminderAlertSource] } as unknown as AppModule;
    const w = ctx('2026-10-07T00:00:00', '2026-10-08T00:00:00');
    expect(await collectAlerts(s, [boom, notif], { sources: {} }, w)).toHaveLength(1);
    expect(await collectAlerts(s, [notif], { sources: { 'notifications.reminders': false } }, w)).toHaveLength(0);
  });
});
