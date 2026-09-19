/**
 * Pure list duplication, in the same spirit as `ordering.ts` and `trash.ts`:
 * no React, no store, so the copy rules are testable as plain functions.
 */

import { createCardId, createListId } from "./ids";
import type { BoardState, Card, CardId, List, ListId } from "./types";

/** One card under a fresh id, keeping its own fields (colour, both thots). */
export function copyCard(card: Card): Card {
  return { ...card, id: createCardId() };
}

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
    const copy = copyCard(state.cards[cardId]);
    cards[copy.id] = copy;
    newCardIds.push(copy.id);
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

/**
 * A board's skeleton: the lists currently on it, in order, with their title,
 * colour, icon and width, plus the board's background -- and nothing else.
 *
 * `state.lists` also keeps the records of trashed lists (a trashed list
 * loses its place in `listOrder` but not its record, so restoring it works),
 * which is why this walks `listOrder` rather than copying `state.lists`.
 * List ids are reused as-is: each board is its own storage document, the same
 * way `duplicateBoard` already shares ids across boards.
 */
export function layoutOnly(state: BoardState): BoardState {
  const lists: Record<ListId, List> = {};
  const cardOrder: Record<ListId, CardId[]> = {};
  for (const listId of state.listOrder) {
    lists[listId] = state.lists[listId];
    cardOrder[listId] = [];
  }
  return {
    lists,
    cards: {},
    listOrder: state.listOrder,
    cardOrder,
    trash: [],
    trashedLists: [],
    background: state.background,
  };
}
