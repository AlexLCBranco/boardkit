import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

import type { CardId } from "../../domain/types";
import {
  readSelectedCardIds,
  useClearSelection,
  useSetSelectedCards,
} from "../../store/selectors";

/** Pixels the pointer must travel before a press on the canvas becomes a
    marquee -- the same threshold the card drag uses, so a plain click on
    empty space stays a click. */
const MARQUEE_THRESHOLD = 4;

/** Anything a press on should keep doing its own job instead of starting a
    marquee: cards and list headers start drags, the rest are controls. */
const INTERACTIVE =
  "[data-card-id], header, button, input, textarea, select, a, [role='separator'], [contenteditable='true']";

/**
 * Drag on empty canvas to draw a box; every card the box touches is selected
 * live, and the selection stays when the pointer is released. Shift adds to
 * the existing selection instead of replacing it. A click on empty canvas
 * clears the selection.
 *
 * Returns the `onPointerDown` for the scroll area. Nothing here fights
 * dnd-kit: its pointer sensor only listens on cards and list headers, which
 * this ignores.
 *
 * The box is drawn by writing straight to `boxRef`'s style rather than
 * through React state -- the same reasoning as the column resize handle: a
 * re-render per pointer move for a rectangle that only exists for the length
 * of a gesture would be pure cost. Only the *set of selected ids* goes to the
 * store, and `setSelected` ignores an unchanged set, so a card re-renders
 * only when the box gains or loses it.
 */
export function useMarqueeSelection(boxRef: RefObject<HTMLDivElement | null>) {
  const setSelected = useSetSelectedCards();
  const clearSelection = useClearSelection();

  return function handlePointerDown(event: ReactPointerEvent<HTMLElement>) {
    const area = event.currentTarget;
    const box = boxRef.current;
    if (!box || event.button !== 0 || !event.isPrimary || !startsOnEmptyCanvas(event, area)) {
      return;
    }

    const startX = event.clientX;
    const startY = event.clientY;
    const additive = event.shiftKey;
    const base = additive ? readSelectedCardIds() : [];
    let isDrawing = false;
    const previousUserSelect = document.body.style.userSelect;

    area.setPointerCapture(event.pointerId);

    function handlePointerMove(moveEvent: PointerEvent) {
      const left = Math.min(startX, moveEvent.clientX);
      const top = Math.min(startY, moveEvent.clientY);
      const width = Math.abs(moveEvent.clientX - startX);
      const height = Math.abs(moveEvent.clientY - startY);

      if (!isDrawing) {
        if (Math.hypot(width, height) < MARQUEE_THRESHOLD) {
          return;
        }
        isDrawing = true;
        // Stops the drag from also highlighting the text under the box.
        document.body.style.userSelect = "none";
        box!.style.display = "block";
      }

      box!.style.transform = `translate(${left}px, ${top}px)`;
      box!.style.width = `${width}px`;
      box!.style.height = `${height}px`;
      setSelected([...base, ...cardsTouching({ left, top, right: left + width, bottom: top + height })]);
    }

    function finish() {
      area.removeEventListener("pointermove", handlePointerMove);
      area.removeEventListener("pointerup", handlePointerUp);
      area.removeEventListener("pointercancel", finish);
      if (area.hasPointerCapture(event.pointerId)) {
        area.releasePointerCapture(event.pointerId);
      }
      document.body.style.userSelect = previousUserSelect;
      box!.style.display = "none";
    }

    function handlePointerUp() {
      finish();
      if (!isDrawing && !additive) {
        clearSelection();
      }
    }

    area.addEventListener("pointermove", handlePointerMove);
    area.addEventListener("pointerup", handlePointerUp);
    area.addEventListener("pointercancel", finish);
  };
}

interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/**
 * True when the press landed on bare canvas. Three things rule it out: the
 * target is inside something interactive; the target is not actually inside
 * the area (React bubbles events out of portals, so a dropdown or dialog
 * opened from a card would otherwise arrive here); or the press was on the
 * area's own scrollbar, which reports the area as its target.
 */
function startsOnEmptyCanvas(event: ReactPointerEvent<HTMLElement>, area: HTMLElement): boolean {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !area.contains(target) || target.closest(INTERACTIVE)) {
    return false;
  }
  const bounds = area.getBoundingClientRect();
  return (
    event.clientX - bounds.left < area.clientWidth && event.clientY - bounds.top < area.clientHeight
  );
}

/**
 * Ids of every card the box overlaps, judged by what is actually visible: a
 * card scrolled out of view inside its own list still has a rect, but the box
 * is not "over" it, so each card's rect is first clipped to its list's
 * scroller. Reads live geometry, so wheel-scrolling mid-drag stays correct.
 * Lists are short by design, so walking every card per pointer move is fine.
 */
function cardsTouching(box: Box): CardId[] {
  const clips = new Map<Element, DOMRect>();
  const ids: CardId[] = [];

  for (const card of document.querySelectorAll<HTMLElement>("[data-card-id]")) {
    const scroller = card.closest("[data-list-scroller]");
    if (!scroller) {
      continue;
    }
    let clip = clips.get(scroller);
    if (!clip) {
      clip = scroller.getBoundingClientRect();
      clips.set(scroller, clip);
    }
    const rect = card.getBoundingClientRect();
    const visible: Box = {
      left: Math.max(rect.left, clip.left),
      top: Math.max(rect.top, clip.top),
      right: Math.min(rect.right, clip.right),
      bottom: Math.min(rect.bottom, clip.bottom),
    };
    if (
      visible.left < visible.right &&
      visible.top < visible.bottom &&
      visible.left <= box.right &&
      visible.right >= box.left &&
      visible.top <= box.bottom &&
      visible.bottom >= box.top
    ) {
      ids.push(card.dataset.cardId as CardId);
    }
  }
  return ids;
}
