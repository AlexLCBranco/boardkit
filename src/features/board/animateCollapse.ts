import { flushSync } from "react-dom";

import { isCollapsed } from "../../domain/collapse";
import type { ListId } from "../../domain/types";
import { useBoardStore } from "../../store/boardStore";

/**
 * Collapses an open list or expands a collapsed one, animated. The one entry
 * point for the header button, the strip, the menu and the `c` shortcut.
 *
 * The header (or strip) it was toggled from is replaced by the other one, so
 * keyboard focus is handed across rather than dropped to <body>.
 */
export function toggleListCollapsed(listId: ListId): void {
  const { collapsedLists, setListCollapsed } = useBoardStore.getState();
  const column = columnOf(listId);
  const hadFocus = column?.contains(document.activeElement) ?? false;
  animateListCollapse(listId, () => setListCollapsed(listId, !isCollapsed(collapsedLists, listId)));
  if (hadFocus) {
    columnOf(listId)?.querySelector<HTMLElement>("[data-list-header]")?.focus();
  }
}

/**
 * Collapsing or expanding a list changes its width, and CLAUDE.md forbids
 * animating `width`. So the width changes instantly and the *consequences*
 * are animated instead, FLIP-style (First, Last, Invert, Play):
 *
 *  1. First: note where every column starts on screen.
 *  2. Last: apply the change synchronously (`flushSync`), so the DOM is
 *     already in its final layout when this function reads it back.
 *  3. Invert: each column that moved is pushed back to where it was with a
 *     `transform`...
 *  4. Play: ...and animated to no transform. The neighbours appear to slide
 *     over, while the browser only ever composites a transform.
 *
 * The toggled column itself fades in (`opacity`), since its left edge never
 * moves. Both run through the Web Animations API rather than inline styles,
 * so nothing here fights dnd-kit's own inline `transform` on the same nodes.
 */
export function animateListCollapse(listId: ListId, change: () => void): void {
  const before = new Map<string, number>();
  for (const column of allColumns()) {
    before.set(column.dataset.listId!, column.getBoundingClientRect().left);
  }

  flushSync(change);

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const rootStyle = getComputedStyle(document.documentElement);
  const timing: KeyframeAnimationOptions = {
    duration: parseFloat(rootStyle.getPropertyValue("--duration-medium")) || 0,
    easing: rootStyle.getPropertyValue("--ease-out").trim() || "ease-out",
  };

  for (const column of allColumns()) {
    const id = column.dataset.listId!;
    if (id === listId) {
      column.animate([{ opacity: 0 }, { opacity: 1 }], timing);
      continue;
    }
    const startLeft = before.get(id);
    if (startLeft === undefined) continue;
    const rect = column.getBoundingClientRect();
    // The rail may be zoomed (ZoomControls), and a transform is applied in
    // the column's own, unzoomed pixels -- so screen distance is divided back
    // by the effective scale.
    const scale = column.offsetWidth > 0 ? rect.width / column.offsetWidth : 1;
    const dx = (startLeft - rect.left) / scale;
    if (Math.abs(dx) < 0.5) continue;
    column.animate([{ transform: `translateX(${dx}px)` }, { transform: "translateX(0)" }], timing);
  }
}

function columnOf(listId: ListId): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-list-id="${listId}"]`);
}

function allColumns(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-list-id]"));
}
