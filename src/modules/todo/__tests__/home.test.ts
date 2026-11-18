import { homeBoards, homeTasks } from '../home';
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

  it('flags unfinished cards created a week or more ago, whatever their list', () => {
    const oldDoing = task({ sectionId: 'doing', createdAt: '2026-11-08T10:00:00.000Z', startedAt: '2026-11-17T10:00:00.000Z' });
    const oldTodo = task({ sectionId: 'todo', createdAt: '2026-11-10T09:00:00.000Z' });
    const recent = task({ sectionId: 'doing', createdAt: '2026-11-15T10:00:00.000Z' });
    const pending = task({ sectionId: 'todo', priority: 1, createdAt: '2026-11-16T10:00:00.000Z' });
    const oldDone = task({ sectionId: 'done', createdAt: '2026-10-01T10:00:00.000Z' });
    const r = homeTasks([recent, oldTodo, pending, oldDoing, oldDone], sections, now);
    expect(r.stale.map((s) => [s.task.id, s.days])).toEqual([
      [oldDoing.id, 10],
      [oldTodo.id, 8],
    ]);
    expect(r.others.map((x) => x.id)).toEqual([pending.id, recent.id]);
    expect(r.total).toBe(4);
  });

  it('puts overdue first, then priority', () => {
    const late = task({ dueDate: '2026-11-10', priority: 4, createdAt: '2026-11-17T10:00:00.000Z' });
    const urgent = task({ priority: 1, createdAt: '2026-11-17T10:00:00.000Z' });
    expect(homeTasks([urgent, late], [], now).others.map((x) => x.id)).toEqual([late.id, urgent.id]);
  });
});

describe('Inicio «Tareas pendientes» by board', () => {
  const now = Date.parse('2026-11-18T10:00:00.000Z');
  const project = (id: string, order: number) =>
    ({ id, ownerId: 'u', createdAt: '', updatedAt: '', areaId: null, name: id, color: '#000', order, archived: false }) as const;

  it('groups cards per board: General first, then boards in order; old cards first', () => {
    const work1 = task({ projectId: 'work', createdAt: '2026-11-17T10:00:00.000Z' });
    const work2 = task({ projectId: 'work', createdAt: '2026-11-01T10:00:00.000Z' });
    const home = task({ projectId: 'home', createdAt: '2026-11-17T10:00:00.000Z' });
    const general = task({ createdAt: '2026-11-17T10:00:00.000Z' });
    const r = homeBoards([work1, home, work2, general], [], [project('work', 2), project('home', 1)], now);
    expect(r.boards.map((b) => b.boardId)).toEqual(['inbox', 'home', 'work']);
    expect(r.boards[2].items.map((i) => [i.task.id, i.days])).toEqual([
      [work2.id, 17],
      [work1.id, null],
    ]);
    expect(r.boards[2].staleCount).toBe(1);
    expect(r.staleCount).toBe(1);
    expect(r.total).toBe(4);
  });
});
