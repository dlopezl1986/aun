import { Platform, View, type GestureResponderEvent } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';

/**
 * Drag & drop of events / notes between days (web: mouse and touch).
 *
 * A long press picks the item up; from then on the pointer is followed at
 * window level (page scrolling is blocked meanwhile) and the day under it is
 * found with `elementFromPoint` + the `data-drop-day` attribute that every
 * droppable cell carries. Native builds keep tap-to-open and edit.
 */
export const canDrag = Platform.OS === 'web' && typeof window !== 'undefined';

export interface DragPoint {
  x: number;
  y: number;
}

/**
 * Props that make a View a drop target for `day` (renders `data-drop-day`).
 * `hours`: the View is a 24 h column, so the drop position is also a time.
 */
export const dropDay = (day: string, hours = false) => ({ dataSet: hours ? { dropDay: day, dropHours: '1' } : { dropDay: day } }) as object;

export function pointOf(e: GestureResponderEvent): DragPoint {
  const n = e.nativeEvent as unknown as { clientX?: number; clientY?: number; pageX: number; pageY: number };
  return { x: n.clientX ?? n.pageX, y: n.clientY ?? n.pageY };
}

/** The droppable day under the pointer (and its box, for the time in the hours view). */
export function dropTargetAt(p: DragPoint): { day: string; rect: DOMRect; hours: boolean } | null {
  if (!canDrag) return null;
  const el = (document.elementFromPoint(p.x, p.y) as HTMLElement | null)?.closest<HTMLElement>('[data-drop-day]');
  return el?.dataset.dropDay ? { day: el.dataset.dropDay, rect: el.getBoundingClientRect(), hours: el.dataset.dropHours === '1' } : null;
}

let active = false;
let endedAt = 0;

/** True right after a drop, so the release does not also "tap" (open) the item. */
export const justDragged = () => Date.now() - endedAt < 400;

type Begin = (point: DragPoint, origin: DragPoint) => void;
const registry = new Map<string, Begin>();

/**
 * Makes an item draggable with the mouse: it starts as soon as the pointer
 * moves a few pixels while pressed (no long press). Touch keeps the long
 * press (`onLongPress`), so scrolling the page with a finger still works.
 * Spread the result on the item; `begin` gets the current and press points.
 */
export function mouseDraggable(key: string, begin: Begin): object {
  if (!canDrag) return {};
  registry.set(key, begin);
  return { dataSet: { dragKey: key } };
}

// One listener for the whole page: it sees the press immediately (before any
// component handler), so even a fast mouse movement is never missed.
if (canDrag) {
  window.addEventListener(
    'mousedown',
    (e) => {
      if (e.button !== 0 || active) return;
      const key = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-drag-key]')?.dataset.dragKey;
      const begin = key ? registry.get(key) : undefined;
      if (!begin) return;
      const origin = { x: e.clientX, y: e.clientY };
      const onMove = (ev: MouseEvent) => {
        if (Math.hypot(ev.clientX - origin.x, ev.clientY - origin.y) < 6) return;
        cleanup();
        begin({ x: ev.clientX, y: ev.clientY }, origin);
      };
      const cleanup = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', cleanup);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', cleanup);
    },
    true,
  );
}

/**
 * Follows the mouse / finger until release (`end(null)` when cancelled with
 * Esc). Returns false when another drag is already running.
 */
export function followPointer(
  handlers: { move: (p: DragPoint) => void; end: (p: DragPoint | null) => void },
  start: DragPoint | null = null,
  /** The start point is already a movement (mouse drag) rather than a still long press. */
  startMoved = false,
): boolean {
  if (active) return false;
  active = true;
  let last: DragPoint | null = start;
  let moved = startMoved;
  const prevSelect = document.body.style.userSelect;
  const move = (p: DragPoint) => {
    last = p;
    moved = true;
    handlers.move(p);
  };
  const onMouseMove = (e: MouseEvent) => move({ x: e.clientX, y: e.clientY });
  const onTouchMove = (e: TouchEvent) => {
    e.preventDefault(); // the finger drags the item, not the page
    const t = e.touches[0];
    if (t) move({ x: t.clientX, y: t.clientY });
  };
  const cleanup = () => {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onDrop);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('touchend', onDrop);
    window.removeEventListener('touchcancel', onCancel);
    window.removeEventListener('keydown', onKey);
    document.body.style.userSelect = prevSelect;
    active = false;
    endedAt = Date.now();
  };
  const onDrop = () => {
    cleanup();
    // Picked up and released without moving: nothing to drop.
    handlers.end(moved ? last : null);
  };
  const onCancel = () => {
    cleanup();
    handlers.end(null);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
  };
  document.body.style.userSelect = 'none';
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onDrop);
  window.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('touchend', onDrop);
  window.addEventListener('touchcancel', onCancel);
  window.addEventListener('keydown', onKey);
  return true;
}

/** The item travelling under the pointer. */
export function DragGhost({ point, label, color, hint }: { point: DragPoint; label: string; color: string; hint?: string | null }) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'fixed' as 'absolute',
        left: point.x + 12,
        top: point.y + 12,
        zIndex: 1000,
        maxWidth: 220,
        paddingVertical: 6,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.md,
        borderLeftWidth: 4,
        borderLeftColor: color,
        backgroundColor: colors.surface,
        boxShadow: `0px 8px 24px ${withAlpha('#000000', 0.25)}, inset 0 0 0 999px ${withAlpha(color, 0.18)}`,
      }}
    >
      <AppText variant="smallStrong" numberOfLines={1}>
        {label}
      </AppText>
      {hint ? (
        <AppText variant="caption" tone="textMuted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}
