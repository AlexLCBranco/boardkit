import type { CardId, ListId } from "../../domain/types";
import { useBoardStore } from "../../store/boardStore";
import {
  cardElement,
  focusCard,
  focusListHeader,
  listHeaderElement,
  verticalCenter,
} from "./dom";

/**
 * Arrow-key focus movement. It only moves DOM focus between elements that
 * already exist and are already focusable -- it never picks anything up, so
 * it cannot be confused with dnd-kit's keyboard drag.
 *
 * The order to walk comes from the store (`cardOrder`, `listOrder`), not from
 * scanning the DOM: the store is the source of truth for what is next to
 * what, and the DOM is only asked to focus the answer.
 */

/** Up: the previous card, or -- from the first card -- the list's header. */
export function focusCardAbove(cardId: CardId, listId: ListId): void {
  const ids = useBoardStore.getState().cardOrder[listId];
  const previous = ids[ids.indexOf(cardId) - 1];
  if (previous) {
    focusCard(previous);
  } else {
    focusListHeader(listId);
  }
}

export function focusCardBelow(cardId: CardId, listId: ListId): void {
  const ids = useBoardStore.getState().cardOrder[listId];
  const next = ids[ids.indexOf(cardId) + 1];
  if (next) {
    focusCard(next);
  }
}

/**
 * Left/right: the card in the nearest list that has cards, picked by how
 * close its vertical middle is to the current card's. Empty lists are
 * skipped -- there is nothing in them to focus.
 */
export function focusCardBeside(cardId: CardId, listId: ListId, direction: -1 | 1): void {
  const from = cardElement(cardId);
  if (!from) {
    return;
  }
  const { listOrder, cardOrder } = useBoardStore.getState();
  const y = verticalCenter(from);

  for (let i = listOrder.indexOf(listId) + direction; i >= 0 && i < listOrder.length; i += direction) {
    const candidates = cardOrder[listOrder[i]]
      .map(cardElement)
      .filter((element): element is HTMLElement => element !== null);
    if (candidates.length === 0) {
      continue;
    }
    const distance = (element: HTMLElement) => Math.abs(verticalCenter(element) - y);
    candidates.reduce((best, element) => (distance(element) < distance(best) ? element : best)).focus();
    return;
  }
}

/** Left/right on a list header: the neighbouring list's header. */
export function focusListBeside(listId: ListId, direction: -1 | 1): void {
  const { listOrder } = useBoardStore.getState();
  const neighbour = listOrder[listOrder.indexOf(listId) + direction];
  if (neighbour && listHeaderElement(neighbour)) {
    focusListHeader(neighbour);
  }
}

/** Down on a list header: its first card. */
export function focusFirstCard(listId: ListId): void {
  const first = useBoardStore.getState().cardOrder[listId][0];
  if (first) {
    focusCard(first);
  }
}
