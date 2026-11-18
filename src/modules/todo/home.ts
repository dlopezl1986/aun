import { isDoneList } from './board/model';
import { isOpen } from './selectors';
import type { Section, Task } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Unfinished for longer than this (since it was created) is flagged on Inicio. */
export const STALE_DAYS = 7;

export interface StaleTask {
  task: Task;
  /** Whole days since it was created. */
  days: number;
}

/**
 * Inicio's «Tareas pendientes»: open top-level cards that are not in a
 * finished list. Cards created more than a week ago and still unfinished come
 * first, apart (Ruka counts from creation, not from when it was started).
 * The rest: overdue, then by priority, then by date.
 */
export function homeTasks(tasks: Task[], sections: Section[], now: number): { stale: StaleTask[]; others: Task[]; total: number } {
  const byId = new Map(sections.map((s) => [s.id, s]));
  const open = tasks.filter((t) => !t.parentTaskId && isOpen(t) && !isDoneList(t.sectionId ? byId.get(t.sectionId)?.name : null));
  const stale: StaleTask[] = [];
  const others: Task[] = [];
  for (const task of open) {
    const since = Date.parse(task.createdAt);
    const days = Number.isFinite(since) ? Math.floor((now - since) / DAY_MS) : 0;
    if (days >= STALE_DAYS) {
      stale.push({ task, days });
      continue;
    }
    others.push(task);
  }
  const today = new Date(now).toISOString().slice(0, 10);
  const rank = (t: Task) => (t.dueDate && t.dueDate < today ? 0 : 1);
  others.sort(
    (a, b) => rank(a) - rank(b) || a.priority - b.priority || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.order - b.order,
  );
  stale.sort((a, b) => b.days - a.days);
  return { stale, others, total: open.length };
}
