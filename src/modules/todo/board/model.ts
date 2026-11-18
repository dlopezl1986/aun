import { isOpen } from '../selectors';
import type { Section, Task } from '../types';

/**
 * Board model (Trello-like): a board is a project, or the general board for
 * tasks without a project; its lists are the project's sections. Tasks without
 * a (known) list sit in a leading "Por hacer" list.
 */
export const GENERAL_BOARD = 'inbox';

/** Id of the leading list that holds cards without a section. */
export const LOOSE_LIST = 'loose';

export const boardOf = (task: Pick<Task, 'projectId'>) => task.projectId ?? GENERAL_BOARD;

export interface BoardColumn {
  /** Section id, or LOOSE_LIST. */
  id: string;
  section: Section | null;
  /** Open top-level cards, in board order. */
  cards: Task[];
  /** Completed top-level cards (shown on demand). */
  done: Task[];
}

const byOrder = (a: Task, b: Task) => a.order - b.order || (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0);

export function boardLists(sections: Section[], boardId: string): Section[] {
  return sections.filter((s) => s.projectId === boardId).sort((a, b) => a.order - b.order);
}

export function boardColumns(tasks: Task[], boardId: string, sections: Section[]): BoardColumn[] {
  const lists = boardLists(sections, boardId);
  const known = new Set(lists.map((s) => s.id));
  const mine = tasks.filter((t) => !t.parentTaskId && boardOf(t) === boardId && t.status !== 'archived');
  const listOf = (t: Task) => (t.sectionId && known.has(t.sectionId) ? t.sectionId : LOOSE_LIST);
  const column = (id: string, section: Section | null): BoardColumn => {
    const own = mine.filter((t) => listOf(t) === id);
    return {
      id,
      section,
      cards: own.filter(isOpen).sort(byOrder),
      done: own.filter((t) => t.status === 'completed').sort((a, b) => ((a.completedAt ?? '') < (b.completedAt ?? '') ? 1 : -1)),
    };
  };
  const loose = column(LOOSE_LIST, null);
  const columns = lists.map((s) => column(s.id, s));
  // The loose list only shows when it has cards, or when the board has no lists yet.
  return loose.cards.length || loose.done.length || !columns.length ? [loose, ...columns] : columns;
}

/**
 * Moves a card inside the board columns (pure): returns the target column's
 * card ids in their new order.
 */
export function moveCard(columns: BoardColumn[], cardId: string, toColumn: string, toIndex: number): string[] {
  const target = columns.find((c) => c.id === toColumn);
  if (!target) return [];
  const ids = target.cards.map((c) => c.id).filter((id) => id !== cardId);
  const index = Math.max(0, Math.min(toIndex, ids.length));
  ids.splice(index, 0, cardId);
  return ids;
}

/** Applies a pending (optimistic) move so the card doesn't jump back while saving. */
export function applyMove(columns: BoardColumn[], move: { cardId: string; toColumn: string; orderedIds: string[] } | null): BoardColumn[] {
  if (!move) return columns;
  const card = columns.flatMap((c) => c.cards).find((c) => c.id === move.cardId);
  if (!card) return columns;
  return columns.map((c) => {
    if (c.id === move.toColumn) {
      const pool = new Map([...columns.flatMap((x) => x.cards)].map((t) => [t.id, t]));
      return { ...c, cards: move.orderedIds.map((id) => pool.get(id)).filter((t): t is Task => !!t) };
    }
    return { ...c, cards: c.cards.filter((t) => t.id !== move.cardId) };
  });
}
