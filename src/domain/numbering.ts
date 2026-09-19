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
 * A card type that isn't numbered (`cardKinds.ts`) gets no number and doesn't
 * count toward the ones after it: "1, 2, divider, 3", not "1, 2, divider, 4".
 *
 * Pure and React-free, like `ordering.ts`, so it is unit-testable on its own.
 */

import { specOf } from "./cardKinds";
import type { Card, CardId, ListId } from "./types";

export function computeCardNumber(
  cardOrder: Readonly<Record<ListId, readonly CardId[]>>,
  cards: Readonly<Record<CardId, Card>>,
  listId: ListId,
  cardId: CardId,
): number | null {
  if (!specOf(cards[cardId]).numbered) {
    return null;
  }
  let number = 0;
  for (const id of cardOrder[listId]) {
    if (specOf(cards[id]).numbered) {
      number += 1;
    }
    if (id === cardId) {
      return number;
    }
  }
  return null;
}
