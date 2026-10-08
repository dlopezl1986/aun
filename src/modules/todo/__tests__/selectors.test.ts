import { filterTasks, taskCounts } from '../selectors';
import type { Task } from '../types';

let n = 0;
function task(p: Partial<Task>): Task {
  n += 1;
  return {
    id: `t${n}`,
    ownerId: 'u',
    createdAt: `2026-10-0${n % 9}T10:00:00.000Z`,
    updatedAt: '',
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

const today = '2026-10-07';

describe('task views', () => {
  const overdue = task({ dueDate: '2026-10-01', priority: 2 });
  const dueToday = task({ dueDate: today, priority: 1 });
  const future = task({ dueDate: '2026-10-20' });
  const inbox = task({});
  const inProject = task({ projectId: 'p1' });
  const done = task({ status: 'completed', completedAt: '2026-10-06T10:00:00Z', dueDate: today });
  const subtask = task({ parentTaskId: dueToday.id, dueDate: today });
  const all = [overdue, dueToday, future, inbox, inProject, done, subtask];

  it('"Hoy" includes due today + overdue, sorted by priority, excluding done and subtasks', () => {
    expect(filterTasks(all, 'today', today).map((t) => t.id)).toEqual([dueToday.id, overdue.id]);
  });

  it('"Bandeja" contains open tasks without project', () => {
    const ids = filterTasks(all, 'inbox', today).map((t) => t.id);
    expect(ids).toContain(inbox.id);
    expect(ids).not.toContain(inProject.id);
    expect(ids).not.toContain(done.id);
  });

  it('counts priority and overdue for the HOY panel', () => {
    const c = taskCounts(all, today);
    expect(c.today).toBe(2);
    expect(c.todayPriority).toBe(1);
    expect(c.overdue).toBe(1);
    expect(c.upcoming).toBe(1);
    expect(c.completed).toBe(1);
  });
});
