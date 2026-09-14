/**
 * Pure trash maths, in the same spirit as `ordering.ts`: no React, no store,
 * so the eviction and restore rules are unit-testable as plain functions.
 *
 * Cards and lists are trashed independently, with different shapes: a
 * trashed card is pulled out of `cardOrder` (its list may still be on the
 * board, still being edited), while a trashed list keeps everything --
 * itself, its `cardOrder` entry, every card in it -- and only loses its spot
 * in `listOrder`. That's what lets restoring a list bring its cards back
 * with no extra bookkeeping.
 */

import type { BoardState, Card, CardId, List, ListId } from "./types";

/** How many deleted cards the trash keeps before it starts forgetting the
    oldest one. A cap, not a time-based purge -- "recently deleted" needs a
    bound, but a background timer to age entries out is more machinery than
    this earns. */
export const TRASH_LIMIT = 20;

/** Same idea, for whole deleted lists. Lower than `TRASH_LIMIT` because one
    entry here can carry many cards with it -- "a few lists" is the ask, not
    dozens. */
export const LIST_TRASH_LIMIT = 10;

/**
 * Moves a card out of its list and into the trash. The card's own record is
 * left alone in `cards` -- only `cardOrder` and `trash` change -- so
 * restoring later is just re-inserting the id, not reconstructing the card.
 *
 * When the trash is already at `TRASH_LIMIT`, the oldest entry is forgotten
 * for real (its `cards` record removed too) to make room.
 */
export function moveCardToTrash(
  state: BoardState,
  listId: ListId,
  cardId: CardId,
  deletedAt: number,
): Pick<BoardState, "cards" | "cardOrder" | "trash"> {
  const trash = [...state.trash, { cardId, listId, deletedAt }];
  const cards = { ...state.cards };

  while (trash.length > TRASH_LIMIT) {
    const evicted = trash.shift();
    if (evicted) {
      delete cards[evicted.cardId];
    }
  }

  return {
    cards,
    cardOrder: {
      ...state.cardOrder,
      [listId]: state.cardOrder[listId].filter((id) => id !== cardId),
    },
    trash,
  };
}

/**
 * Puts a trashed card back at the end of its original list. Returns `null`
 * if that list isn't currently on the board -- either it was trashed too in
 * the meantime (its own record still exists, but `listOrder` doesn't have
 * it) or it was permanently deleted -- callers should fall back to offering
 * only a permanent delete in that case.
 */
export function restoreCardFromTrash(
  state: BoardState,
  cardId: CardId,
): Pick<BoardState, "cardOrder" | "trash"> | null {
  const entry = state.trash.find((e) => e.cardId === cardId);
  if (!entry || !state.listOrder.includes(entry.listId)) {
    return null;
  }

  return {
    cardOrder: {
      ...state.cardOrder,
      [entry.listId]: [...state.cardOrder[entry.listId], cardId],
    },
    trash: state.trash.filter((e) => e.cardId !== cardId),
  };
}

/** Forgets one trashed card for good: its `cards` record and trash entry
    both go. */
export function permanentlyDeleteCard(
  state: BoardState,
  cardId: CardId,
): Pick<BoardState, "cards" | "trash"> {
  const cards = { ...state.cards };
  delete cards[cardId];
  return { cards, trash: state.trash.filter((e) => e.cardId !== cardId) };
}

/** Forgets every trashed card at once. */
export function emptyTrash(state: BoardState): Pick<BoardState, "cards" | "trash"> {
  const cards = { ...state.cards };
  for (const entry of state.trash) {
    delete cards[entry.cardId];
  }
  return { cards, trash: [] };
}

/** Erases one trashed list for good, including every card still sitting in
    its `cardOrder` entry. Shared by the eviction loop below and by
    `permanentlyDeleteList`. */
function forgetList(
  lists: Record<ListId, List>,
  cards: Record<CardId, Card>,
  cardOrder: Record<ListId, readonly CardId[]>,
  listId: ListId,
): void {
  for (const cardId of cardOrder[listId] ?? []) {
    delete cards[cardId];
  }
  delete lists[listId];
  delete cardOrder[listId];
}

/**
 * Moves a list out of `listOrder` and into the trash. Nothing else about it
 * changes -- its own record, its `cardOrder` entry and every card in it stay
 * exactly as they were, so restoring needs no reconstruction.
 *
 * When the list trash is already at `LIST_TRASH_LIMIT`, the oldest trashed
 * list is forgotten for real, cards included, to make room.
 */
export function moveListToTrash(
  state: BoardState,
  listId: ListId,
  deletedAt: number,
): Pick<BoardState, "lists" | "cards" | "cardOrder" | "listOrder" | "trashedLists"> {
  const trashedLists = [...state.trashedLists, { listId, deletedAt }];
  let lists = state.lists;
  let cards = state.cards;
  let cardOrder = state.cardOrder;

  while (trashedLists.length > LIST_TRASH_LIMIT) {
    const evicted = trashedLists.shift();
    if (!evicted) break;
    if (lists === state.lists) lists = { ...state.lists };
    if (cards === state.cards) cards = { ...state.cards };
    if (cardOrder === state.cardOrder) cardOrder = { ...state.cardOrder };
    forgetList(lists, cards, cardOrder, evicted.listId);
  }

  return {
    lists,
    cards,
    cardOrder,
    listOrder: state.listOrder.filter((id) => id !== listId),
    trashedLists,
  };
}

/** Puts a trashed list back at the end of the board. Its own record,
    `cardOrder` entry and cards were never touched, so this is only
    `listOrder` and `trashedLists`. */
export function restoreListFromTrash(
  state: BoardState,
  listId: ListId,
): Pick<BoardState, "listOrder" | "trashedLists"> | null {
  if (!state.trashedLists.some((e) => e.listId === listId)) {
    return null;
  }
  return {
    listOrder: [...state.listOrder, listId],
    trashedLists: state.trashedLists.filter((e) => e.listId !== listId),
  };
}

/** Forgets one trashed list for good, cards included. */
export function permanentlyDeleteList(
  state: BoardState,
  listId: ListId,
): Pick<BoardState, "lists" | "cards" | "cardOrder" | "trashedLists"> {
  const lists = { ...state.lists };
  const cards = { ...state.cards };
  const cardOrder = { ...state.cardOrder };
  forgetList(lists, cards, cardOrder, listId);
  return { lists, cards, cardOrder, trashedLists: state.trashedLists.filter((e) => e.listId !== listId) };
}

/** Forgets every trashed list at once, cards included. */
export function emptyListTrash(
  state: BoardState,
): Pick<BoardState, "lists" | "cards" | "cardOrder" | "trashedLists"> {
  const lists = { ...state.lists };
  const cards = { ...state.cards };
  const cardOrder = { ...state.cardOrder };
  for (const entry of state.trashedLists) {
    forgetList(lists, cards, cardOrder, entry.listId);
  }
  return { lists, cards, cardOrder, trashedLists: [] };
}
