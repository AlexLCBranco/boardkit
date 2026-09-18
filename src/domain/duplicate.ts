/**
 * Pure list duplication, in the same spirit as `ordering.ts` and `trash.ts`:
 * no React, no store, so the copy rules are testable as plain functions.
 */

import { createCardId, createListId } from "./ids";
import type { BoardState, Card, CardId, ListId } from "./types";

/**
 * Copies a list -- its title, colour, icon, width, and every card in it --
 * and slots the copy immediately to the right of the original.
 *
 * Cards get fresh ids: a card belongs to exactly one list (membership lives
 * in `cardOrder`), so two lists cannot share card records the way two boards
 * can. Each copied card keeps its own fields (colour, both thots) via spread.
 *
 * Returns only the slices that changed, so the store can hand it straight to
 * `withHistory` and the whole duplication is a single undo step.
 */
export function duplicateList(
  state: BoardState,
  listId: ListId,
  title: string,
): Pick<BoardState, "lists" | "cards" | "listOrder" | "cardOrder"> {
  const newListId = createListId();
  const cards: Record<CardId, Card> = { ...state.cards };
  const newCardIds: CardId[] = [];

  for (const cardId of state.cardOrder[listId]) {
    const id = createCardId();
    cards[id] = { ...state.cards[cardId], id };
    newCardIds.push(id);
  }

  const at = state.listOrder.indexOf(listId);
  const listOrder = [...state.listOrder];
  listOrder.splice(at + 1, 0, newListId);

  return {
    lists: { ...state.lists, [newListId]: { ...state.lists[listId], id: newListId, title } },
    cards,
    listOrder,
    cardOrder: { ...state.cardOrder, [newListId]: newCardIds },
  };
}
