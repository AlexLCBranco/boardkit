/**
 * Pure rules for putting a copy of a card or list into *another* board, in
 * the same spirit as `duplicate.ts`: no React, no store, so they are plain
 * functions over a loaded `BoardState`.
 *
 * Both work on the target board's own state (loaded from storage by the
 * caller), never the board on screen, and both give the copies fresh ids --
 * copying the same card twice, or moving it back and forth, must never leave
 * two records with one id.
 */

import { copyCard } from "./duplicate";
import { createListId } from "./ids";
import { isListFull } from "./limits";
import type { BoardState, Card, CardId, List, ListId } from "./types";

/**
 * A copy of `card`, appended to the bottom of `listId` on `target`.
 *
 * Returns `null` if that list is not on the target board or is full
 * (`isListFull`) -- a second guard behind the picker, which already greys
 * full lists out.
 */
export function insertCardCopy(target: BoardState, card: Card, listId: ListId): BoardState | null {
  const cardIds = target.cardOrder[listId];
  if (!target.listOrder.includes(listId) || !cardIds || isListFull(cardIds)) return null;

  const copy = copyCard(card);
  return {
    ...target,
    cards: { ...target.cards, [copy.id]: copy },
    cardOrder: { ...target.cardOrder, [listId]: [...cardIds, copy.id] },
  };
}

/**
 * A copy of `list` and its `cards` (in order), appended to the right-hand
 * end of `target`. The list keeps its title, colour, icon and width.
 */
export function insertListCopy(
  target: BoardState,
  list: List,
  cards: readonly Card[],
): BoardState {
  const listId = createListId();
  const newCards: Record<CardId, Card> = { ...target.cards };
  const cardIds: CardId[] = [];
  for (const card of cards) {
    const copy = copyCard(card);
    newCards[copy.id] = copy;
    cardIds.push(copy.id);
  }

  return {
    ...target,
    lists: { ...target.lists, [listId]: { ...list, id: listId } },
    cards: newCards,
    listOrder: [...target.listOrder, listId],
    cardOrder: { ...target.cardOrder, [listId]: cardIds },
  };
}
