import type { CardId, ListId } from "../../domain/types";

/**
 * Where keyboard focus is, read off the DOM. Cards and list headers already
 * carry the attributes this needs (`data-card-id`, `data-list-id`, plus
 * `data-list-header` on the header), and dnd-kit already makes them focusable,
 * so "the focused card" needs no state of its own.
 */

export type FocusTarget =
  | { readonly scope: "card"; readonly cardId: CardId; readonly listId: ListId }
  | { readonly scope: "list"; readonly listId: ListId }
  | { readonly scope: "global" };

/** Only the card or header element *itself* counts: focus on a button inside
    a card (its delete button, say) keeps that button's own keys. */
export function focusTargetOf(node: EventTarget | null): FocusTarget {
  if (!(node instanceof HTMLElement)) {
    return { scope: "global" };
  }
  const listId = node.closest<HTMLElement>("[data-list-id]")?.dataset.listId as ListId | undefined;
  if (listId && node.matches("[data-card-id]")) {
    return { scope: "card", cardId: node.dataset.cardId as CardId, listId };
  }
  if (listId && node.matches("[data-list-header]")) {
    return { scope: "list", listId };
  }
  return { scope: "global" };
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable;
}

/**
 * True while a card or list is picked up with the keyboard (Space), or being
 * dragged at all. dnd-kit marks the dragged node `aria-pressed`, and during
 * that time the arrow keys and Space are its own.
 */
export function isDragging(): boolean {
  return (
    document.querySelector(
      '[data-card-id][aria-pressed="true"], [data-list-header][aria-pressed="true"]',
    ) !== null
  );
}

export function cardElement(cardId: CardId): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-card-id="${cardId}"]`);
}

export function listHeaderElement(listId: ListId): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-list-id="${listId}"] [data-list-header]`);
}

export function focusCard(cardId: CardId): void {
  cardElement(cardId)?.focus();
}

export function focusListHeader(listId: ListId): void {
  listHeaderElement(listId)?.focus();
}

/** Vertical middle of a card on screen, for picking the closest card in a
    neighbouring list -- cards differ in height, so index would drift. */
export function verticalCenter(element: HTMLElement): number {
  const rect = element.getBoundingClientRect();
  return rect.top + rect.height / 2;
}

// The paste shortcut needs a destination, and the board has no notion of a
// focused list for a pointer user, so the last known pointer position stands
// in for one.
let pointer = { x: 0, y: 0 };

export function recordPointer(event: PointerEvent): void {
  pointer = { x: event.clientX, y: event.clientY };
}

export function listUnderPointer(): ListId | null {
  const column = document.elementFromPoint(pointer.x, pointer.y)?.closest<HTMLElement>("[data-list-id]");
  return (column?.dataset.listId as ListId | undefined) ?? null;
}
