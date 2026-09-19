/**
 * Pure rules for copying cards and pasting them into a list, in the same
 * spirit as `duplicate.ts`: no React, no store, so they are plain functions.
 */

import { copyCard } from "./duplicate";
import { cardRoom } from "./limits";
import type { BoardState, Card, CardId, ListId } from "./types";

/**
 * The selected cards that are still on the board, in board order (lists
 * left to right, cards top to bottom) -- not in the order they were selected.
 * A marquee has no meaningful "first", and pasting in board order gives back
 * the layout the cards had.
 *
 * Walking `listOrder` also drops anything trashed since it was selected:
 * a trashed card has left `cardOrder`, and a trashed list has left
 * `listOrder`.
 */
export function cardsInBoardOrder(
  state: BoardState,
  selected: Readonly<Record<CardId, true>>,
): Card[] {
  const cards: Card[] = [];
  for (const listId of state.listOrder) {
    for (const cardId of state.cardOrder[listId]) {
      if (selected[cardId]) {
        cards.push(state.cards[cardId]);
      }
    }
  }
  return cards;
}

/**
 * Pastes copies of `cards` at the bottom of a list, under fresh ids (a card
 * belongs to exactly one list, so a paste can never share a record with its
 * source -- see `copyCard`).
 *
 * The 50-card limit applies to a paste like every other way a card enters a
 * list: cards past the limit are left out rather than refusing the whole
 * paste. Returns the slices that changed, so the store can hand it straight
 * to `withHistory` and the paste is one undo step -- or `null` when there is
 * nothing to do.
 */
export function pasteCardsIntoList(
  state: BoardState,
  listId: ListId,
  cards: readonly Card[],
): Pick<BoardState, "cards" | "cardOrder"> | null {
  const cardIds = state.cardOrder[listId];
  if (!cardIds) {
    return null;
  }
  const copies = cards.slice(0, cardRoom(cardIds)).map(copyCard);
  if (copies.length === 0) {
    return null;
  }

  const nextCards: Record<CardId, Card> = { ...state.cards };
  for (const copy of copies) {
    nextCards[copy.id] = copy;
  }
  return {
    cards: nextCards,
    cardOrder: { ...state.cardOrder, [listId]: [...cardIds, ...copies.map((copy) => copy.id)] },
  };
}
