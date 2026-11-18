import { homeTasks } from '../home';
import type { Section, Task } from '../types';

let n = 0;
function task(p: Partial<Task>): Task {
  n += 1;
  return {
    id: `t${n}`,
    ownerId: 'u',
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
    title: `Task ${n}`,
    status: 'pending',
    priority: 4,
    tagIds: [],
    links: [],
    attachments: [],
    reminders: [],
    order: n,
    ...p,
  };
}
const section = (id: string, name: string): Section => ({ id, ownerId: 'u', createdAt: '', updatedAt: '', projectId: 'p', name, order: 0 });

describe('Inicio «Tareas pendientes»', () => {
  const now = Date.parse('2026-11-18T10:00:00.000Z');
  const sections = [section('doing', 'En curso'), section('done', 'Hecho'), section('todo', 'Por hacer')];

  it('is empty when everything is finished', () => {
    const r = homeTasks([task({ status: 'completed' }), task({ sectionId: 'done' })], sections, now);
    expect(r.total).toBe(0);
  });

  it('flags cards «en curso» for a week or more, by status or list', () => {
    const oldList = task({ sectionId: 'doing', startedAt: '2026-11-08T10:00:00.000Z' });
    const oldStatus = task({ status: 'in_progress', startedAt: '2026-11-10T09:00:00.000Z' });
    const recent = task({ sectionId: 'doing', startedAt: '2026-11-15T10:00:00.000Z' });
    const pending = task({ sectionId: 'todo', priority: 1 });
    const r = homeTasks([recent, oldStatus, pending, oldList], sections, now);
    expect(r.stale.map((s) => [s.task.id, s.days])).toEqual([
      [oldList.id, 10],
      [oldStatus.id, 8],
    ]);
    expect(r.others.map((x) => x.id)).toEqual([pending.id, recent.id]);
    expect(r.total).toBe(4);
  });

  it('puts overdue first, then priority', () => {
    const late = task({ dueDate: '2026-11-10', priority: 4 });
    const urgent = task({ priority: 1 });
    expect(homeTasks([urgent, late], [], now).others.map((x) => x.id)).toEqual([late.id, urgent.id]);
  });
});
