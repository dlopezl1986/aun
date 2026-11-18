import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Trello-like drag & drop of cards between lists (web: desktop and mobile
 * browsers). Mouse: press and move. Touch: press and hold, then move — a quick
 * swipe still scrolls the board. Cards and lists are found through their DOM
 * ids (`card-<id>`, `list-<id>`), so the components only need to set `id`.
 *
 * On native apps there is no drag; cards offer "Mover a…" instead.
 */
export const dragSupported = Platform.OS === 'web' && typeof document !== 'undefined';

export const cardDomId = (id: string) => `card-${id}`;
export const listDomId = (id: string) => `list-${id}`;

export interface DragState {
  cardId: string;
  fromList: string;
  overList: string;
  overIndex: number;
  /** Pointer position (viewport). */
  x: number;
  y: number;
  /** Board root position (viewport): the floating card is placed relative to it. */
  rootX: number;
  rootY: number;
  /** Grab offset inside the card, and its size. */
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

interface Pending {
  cardId: string;
  fromList: string;
  el: HTMLElement;
  startX: number;
  startY: number;
  touch: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

const HOLD_MS = 280;
const SLOP = 8;
const EDGE = 64;
const MAX_SPEED = 11;

function scrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let node = el?.parentElement ?? null; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) return node;
  }
  return (document.scrollingElement as HTMLElement | null) ?? null;
}

/** Speed for auto-scrolling when the pointer is close to an edge. */
function edgeSpeed(pos: number, start: number, end: number): number {
  if (pos < start + EDGE) return -MAX_SPEED * Math.min(1, (start + EDGE - pos) / EDGE);
  if (pos > end - EDGE) return MAX_SPEED * Math.min(1, (pos - (end - EDGE)) / EDGE);
  return 0;
}

export function useBoardDrag(onDrop: (cardId: string, toList: string, index: number) => void, enabled = true) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const pending = useRef<Pending | null>(null);
  const root = useRef<HTMLElement | null>(null);
  const scroller = useRef<HTMLElement | null>(null);
  const lastDragEnd = useRef(0);
  const onDropRef = useRef(onDrop);
  const enabledRef = useRef(enabled);
  useEffect(() => {
    onDropRef.current = onDrop;
    enabledRef.current = enabled;
  }, [onDrop, enabled]);

  const update = (next: DragState | null) => {
    dragRef.current = next;
    setDrag(next);
  };

  /** Which list and position are under the pointer. */
  const locate = useCallback((x: number, y: number, cardId: string): { list: string; index: number } | null => {
    const lists = [...(root.current?.querySelectorAll<HTMLElement>('[id^="list-"]') ?? [])];
    if (!lists.length) return null;
    let best = lists[0];
    let bestDist = Infinity;
    for (const el of lists) {
      const r = el.getBoundingClientRect();
      const dist = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
      if (dist < bestDist) {
        best = el;
        bestDist = dist;
      }
    }
    let index = 0;
    for (const card of best.querySelectorAll<HTMLElement>('[id^="card-"]')) {
      if (card.id === cardDomId(cardId)) continue;
      const r = card.getBoundingClientRect();
      if (r.height && r.top + r.height / 2 < y) index += 1;
    }
    return { list: best.id.slice('list-'.length), index };
  }, []);

  const moveTo = useCallback(
    (x: number, y: number) => {
      const current = dragRef.current;
      if (!current) return;
      const at = locate(x, y, current.cardId);
      const r = root.current?.getBoundingClientRect();
      update({
        ...current,
        x,
        y,
        rootX: r?.left ?? 0,
        rootY: r?.top ?? 0,
        overList: at?.list ?? current.overList,
        overIndex: at?.index ?? current.overIndex,
      });
    },
    [locate],
  );

  const start = useCallback(
    (p: Pending, x: number, y: number) => {
      const r = p.el.getBoundingClientRect();
      const at = locate(x, y, p.cardId);
      update({
        cardId: p.cardId,
        fromList: p.fromList,
        overList: at?.list ?? p.fromList,
        overIndex: at?.index ?? 0,
        x,
        y,
        rootX: root.current?.getBoundingClientRect().left ?? 0,
        rootY: root.current?.getBoundingClientRect().top ?? 0,
        offsetX: x - r.left,
        offsetY: y - r.top,
        width: r.width,
        height: r.height,
      });
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
      if (p.touch) navigator.vibrate?.(10);
    },
    [locate],
  );

  const finish = useCallback((drop: boolean) => {
    const p = pending.current;
    if (p?.timer) clearTimeout(p.timer);
    pending.current = null;
    const current = dragRef.current;
    if (current) {
      lastDragEnd.current = Date.now();
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      update(null);
      if (drop) onDropRef.current(current.cardId, current.overList, current.overIndex);
    }
  }, []);

  useEffect(() => {
    if (!dragSupported) return;
    const onMove = (e: PointerEvent) => {
      const p = pending.current;
      if (!p) return;
      if (dragRef.current) {
        moveTo(e.clientX, e.clientY);
        return;
      }
      const far = Math.hypot(e.clientX - p.startX, e.clientY - p.startY) > SLOP;
      if (!far) return;
      if (p.touch)
        finish(false); // a swipe: let the browser scroll
      else start(p, e.clientX, e.clientY);
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dragRef.current) finish(false);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onCancel);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onCancel);
      document.removeEventListener('keydown', onKey);
    };
  }, [finish, moveTo, start]);

  // Auto-scroll while dragging near the edges (horizontal: the board; vertical: the page).
  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    let id = 0;
    const tick = () => {
      const current = dragRef.current;
      if (!current) return;
      let moved = false;
      const h = scroller.current;
      if (h) {
        const r = h.getBoundingClientRect();
        const dx = edgeSpeed(current.x, Math.max(r.left, 0), Math.min(r.right, window.innerWidth));
        if (dx && h.scrollLeft + dx >= 0 && h.scrollLeft + dx <= h.scrollWidth - h.clientWidth + 1) {
          h.scrollLeft += dx;
          moved = true;
        }
      }
      const v = scrollParent(root.current);
      if (v) {
        const isPage = v === document.scrollingElement;
        const r = isPage ? { top: 0, bottom: window.innerHeight } : v.getBoundingClientRect();
        const dy = edgeSpeed(current.y, Math.max(r.top, 0), Math.min(r.bottom, window.innerHeight));
        if (dy && v.scrollTop + dy >= 0 && v.scrollTop + dy <= v.scrollHeight - v.clientHeight + 1) {
          v.scrollTop += dy;
          moved = true;
        }
      }
      if (moved) moveTo(current.x, current.y);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [dragging, moveTo]);

  /** Ref for the board's root (listens for presses on cards). */
  const rootRef = useCallback(
    (node: unknown) => {
      const el = node as HTMLElement | null;
      if (!dragSupported || root.current === el) return;
      root.current = el;
      if (!el) return;
      el.addEventListener('pointerdown', (e: PointerEvent) => {
        if (e.button !== 0 || dragRef.current || !enabledRef.current) return;
        const target = e.target as HTMLElement;
        if (target.closest('input, textarea, [data-nodrag]')) return;
        const card = target.closest<HTMLElement>('[id^="card-"]');
        const list = card?.closest<HTMLElement>('[id^="list-"]');
        if (!card || !list) return;
        const p: Pending = {
          cardId: card.id.slice('card-'.length),
          fromList: list.id.slice('list-'.length),
          el: card,
          startX: e.clientX,
          startY: e.clientY,
          touch: e.pointerType !== 'mouse',
          timer: null,
        };
        if (p.touch) p.timer = setTimeout(() => pending.current === p && start(p, p.startX, p.startY), HOLD_MS);
        pending.current = p;
      });
      // While dragging with a finger, the page must not scroll. The listener is
      // registered up front (non-passive) so the browser waits for it.
      el.addEventListener(
        'touchmove',
        (e: TouchEvent) => {
          if (dragRef.current) e.preventDefault();
        },
        { passive: false },
      );
      // Long press on Android opens the context menu; on a card it starts a drag.
      el.addEventListener('contextmenu', (e: Event) => {
        if ((e.target as HTMLElement).closest('[id^="card-"]')) e.preventDefault();
      });
    },
    [start],
  );

  const scrollerRef = useCallback((node: unknown) => {
    // ScrollView on web: the scrollable element is the host node itself.
    const n = node as { getScrollableNode?: () => HTMLElement } | HTMLElement | null;
    scroller.current = n && 'getScrollableNode' in n && n.getScrollableNode ? n.getScrollableNode() : (n as HTMLElement | null);
  }, []);

  /** True right after a drag ended: the release must not open the card. */
  const justDragged = useCallback(() => Date.now() - lastDragEnd.current < 350, []);

  return { drag, rootRef, scrollerRef, justDragged };
}
