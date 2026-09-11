/**
 * Card numbering, computed from position rather than stored.
 *
 * Storing a number on the card would mean rewriting every card after the one
 * that moved on every reorder. Deriving it here instead means the cost lands
 * only where it belongs -- at render, for the cards whose number actually
 * changed -- and it can never drift out of sync with the order it describes.
 *
 * Pure and React-free, like `ordering.ts`, so it is unit-testable on its own.
 */

import type { CardId, ListId, NumberingScope } from "./types";

export function computeCardNumber(
  scope: NumberingScope,
  listOrder: readonly ListId[],
  cardOrder: Readonly<Record<ListId, readonly CardId[]>>,
  listId: ListId,
  cardId: CardId,
): number | null {
  if (scope === "off") {
    return null;
  }

  const indexInList = cardOrder[listId].indexOf(cardId);
  if (indexInList === -1) {
    return null;
  }

  if (scope === "list") {
    return indexInList + 1;
  }

  // "board" scope: count every card in every list before this one, then add
  // this card's own position within its list.
  let precedingCount = 0;
  for (const id of listOrder) {
    if (id === listId) {
      break;
    }
    precedingCount += cardOrder[id].length;
  }
  return precedingCount + indexInList + 1;
}
