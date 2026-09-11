/**
 * Card numbering, computed from position rather than stored.
 *
 * Storing a number on the card would mean rewriting every card after the one
 * that moved on every reorder. Deriving it here instead means the cost lands
 * only where it belongs -- at render, for the cards whose number actually
 * changed -- and it can never drift out of sync with the order it describes.
 *
 * Always per-list (each list numbers its own cards from 1): the board used
 * to also offer "off" and a board-wide continuous count, configurable from a
 * toolbar control, but per-list is the only one anyone actually wanted, so
 * the choice -- and the setting it would otherwise need -- is gone.
 *
 * Pure and React-free, like `ordering.ts`, so it is unit-testable on its own.
 */

import type { CardId, ListId } from "./types";

export function computeCardNumber(
  cardOrder: Readonly<Record<ListId, readonly CardId[]>>,
  listId: ListId,
  cardId: CardId,
): number | null {
  const indexInList = cardOrder[listId].indexOf(cardId);
  return indexInList === -1 ? null : indexInList + 1;
}
