/**
 * Card numbering, computed from position rather than stored.
 *
 * Storing a number on the card would mean rewriting every card after the one
 * that moved on every reorder. Deriving it here instead means it can never
 * drift out of sync with the order it describes.
 *
 * Each list numbers its own cards from 1, unless it is set to continue
 * (`List.continuesNumbering`): then it picks up where the list to its left
 * finished. Links chain -- if B continues A and C continues B, C starts after
 * A's and B's cards combined. The link follows board order, not a stored
 * list id, so reordering lists or deleting the one to the left just makes
 * the list continue from whichever list is now beside it.
 *
 * A card type that isn't numbered (`cardKinds.ts`) gets no number and doesn't
 * count toward the ones after it: "1, 2, divider, 3", not "1, 2, divider, 4".
 *
 * Numbers are computed for a whole list in one pass (`numberCards`), not
 * card by card: a per-card lookup meant every card scanning its own list on
 * every store update, which is quadratic and sat on the drag hot path.
 *
 * Pure and React-free, like `ordering.ts`, so it is unit-testable on its own.
 */

import { specOf } from "./cardKinds";
import type { Card, CardId, List, ListId } from "./types";

type CardOrder = Readonly<Record<ListId, readonly CardId[]>>;
type Cards = Readonly<Record<CardId, Card>>;

function countNumbered(cardIds: readonly CardId[], cards: Cards): number {
  let count = 0;
  for (const id of cardIds) {
    if (specOf(cards[id]).numbered) {
      count += 1;
    }
  }
  return count;
}

/**
 * How many numbers come before this list's first card: 0 for a list that
 * starts from 1, or the running total of the chain of lists it continues.
 */
export function numberingOffset(
  listOrder: readonly ListId[],
  lists: Readonly<Record<ListId, List>>,
  cardOrder: CardOrder,
  cards: Cards,
  listId: ListId,
): number {
  let offset = 0;
  for (let i = listOrder.indexOf(listId); i > 0 && lists[listOrder[i]]?.continuesNumbering; i -= 1) {
    offset += countNumbered(cardOrder[listOrder[i - 1]] ?? [], cards);
  }
  return offset;
}

/**
 * Every card's display number, in the same order as `cardIds`: `null` for a
 * card type that isn't numbered.
 */
export function numberCards(
  cardIds: readonly CardId[],
  cards: Cards,
  offset: number,
): (number | null)[] {
  let number = offset;
  return cardIds.map((id) => {
    if (!specOf(cards[id]).numbered) {
      return null;
    }
    number += 1;
    return number;
  });
}
