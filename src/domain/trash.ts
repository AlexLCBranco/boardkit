/**
 * Pure trash maths, in the same spirit as `ordering.ts`: no React, no store,
 * so the eviction and restore rules are unit-testable as plain functions.
 */

import type { BoardState, CardId, ListId } from "./types";

/** How many deleted cards the trash keeps before it starts forgetting the
    oldest one. A cap, not a time-based purge -- "recently deleted" needs a
    bound, but a background timer to age entries out is more machinery than
    this earns. */
export const TRASH_LIMIT = 50;

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
 * if that list no longer exists (deleted while the card sat in the trash) --
 * callers should fall back to offering only a permanent delete in that case.
 */
export function restoreCardFromTrash(
  state: BoardState,
  cardId: CardId,
): Pick<BoardState, "cardOrder" | "trash"> | null {
  const entry = state.trash.find((e) => e.cardId === cardId);
  if (!entry || !state.lists[entry.listId]) {
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
