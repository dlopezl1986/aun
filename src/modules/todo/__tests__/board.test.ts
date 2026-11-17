import { applyMove, boardColumns, GENERAL_BOARD, LOOSE_LIST, moveCard } from '../board/model';
import type { Section, Task } from '../types';

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

const section = (id: string, projectId: string, order: number): Section => ({
  id,
  ownerId: 'u',
  createdAt: '',
  updatedAt: '',
  projectId,
  name: id,
  order,
});

describe('board columns', () => {
  it('puts tasks without a project on the general board, in one "to do" list', () => {
    const a = task({ order: 2 });
    const b = task({ order: 1 });
    const other = task({ projectId: 'p1' });
    const cols = boardColumns([a, b, other], GENERAL_BOARD, []);
    expect(cols.map((c) => c.id)).toEqual([LOOSE_LIST]);
    expect(cols[0].cards.map((c) => c.id)).toEqual([b.id, a.id]);
  });

  it('shows lists in order, hides the loose list when empty, keeps done cards apart', () => {
    const sections = [section('s2', 'p1', 1), section('s1', 'p1', 0)];
    const open = task({ projectId: 'p1', sectionId: 's1' });
    const done = task({ projectId: 'p1', sectionId: 's2', status: 'completed', completedAt: '2026-10-01' });
    const sub = task({ projectId: 'p1', sectionId: 's1', parentTaskId: open.id });
    const cols = boardColumns([open, done, sub], 'p1', sections);
    expect(cols.map((c) => c.id)).toEqual(['s1', 's2']);
    expect(cols[0].cards.map((c) => c.id)).toEqual([open.id]);
    expect(cols[1].cards).toEqual([]);
    expect(cols[1].done.map((c) => c.id)).toEqual([done.id]);
  });

  it('cards whose list was deleted go to the loose list', () => {
    const orphan = task({ projectId: 'p1', sectionId: 'gone' });
    const cols = boardColumns([orphan], 'p1', [section('s1', 'p1', 0)]);
    expect(cols.map((c) => c.id)).toEqual([LOOSE_LIST, 's1']);
    expect(cols[0].cards[0].id).toBe(orphan.id);
  });

  it('moves a card between lists and applies it optimistically', () => {
    const sections = [section('s1', 'p1', 0), section('s2', 'p1', 1)];
    const a = task({ projectId: 'p1', sectionId: 's1' });
    const b = task({ projectId: 'p1', sectionId: 's2' });
    const c = task({ projectId: 'p1', sectionId: 's2' });
    const cols = boardColumns([a, b, c], 'p1', sections);
    const ids = moveCard(cols, a.id, 's2', 1);
    expect(ids).toEqual([b.id, a.id, c.id]);
    const next = applyMove(cols, { cardId: a.id, toColumn: 's2', orderedIds: ids });
    expect(next[0].cards).toEqual([]);
    expect(next[1].cards.map((x) => x.id)).toEqual(ids);
    // Reordering inside the same list.
    expect(moveCard(cols, c.id, 's2', 0)).toEqual([c.id, b.id]);
  });
});
