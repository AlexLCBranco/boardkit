import { pushEntry, type History } from "./history";
import type { BoardState } from "./types";

/**
 * A card drag as one transaction.
 *
 * While a card is dragged across lists, the store's `cardOrder` is really
 * rewritten at every list boundary -- it has to be, because each list's
 * `SortableContext` reads its items from the store, and that is what makes
 * the destination list open a gap under the pointer. None of those
 * intermediate writes are recorded as history. Instead the drag remembers
 * `cardOrder` as it was when the card was picked up (the *origin*), and on
 * drop this settles the whole gesture into a single undo step. A cancelled
 * drag simply puts the origin back and records nothing.
 *
 * The origin is kept by reference, not copied: the store never mutates a
 * slice, so the object from before the drag is still intact afterwards.
 */
type CardOrder = BoardState["cardOrder"];

/**
 * Compares two card orders by content. Reference equality is not enough
 * here: a card dragged into another list and back again ends in the same
 * order as it started, but in freshly built arrays.
 */
export function sameCardOrder(a: CardOrder, b: CardOrder): boolean {
  if (a === b) {
    return true;
  }
  const keys = Object.keys(a) as (keyof CardOrder)[];
  if (keys.length !== Object.keys(b).length) {
    return false;
  }
  return keys.every((listId) => {
    const left = a[listId];
    const right = b[listId];
    return (
      left === right ||
      (right !== undefined && left.length === right.length && left.every((id, i) => id === right[i]))
    );
  });
}

/**
 * The drop half of the transaction. A drag that ended where it began
 * restores the origin itself -- the same references every list rendered
 * before the drag -- and leaves history alone. Anything else becomes one
 * entry spanning origin to final position, however many lists the card
 * visited on the way. `board` is the rest of the board (its `cardOrder`,
 * the preview's, is replaced by `origin`).
 */
export function settleCardDrag(
  history: History,
  origin: CardOrder,
  final: CardOrder,
  board: BoardState,
): { cardOrder: CardOrder; history: History } {
  if (sameCardOrder(origin, final)) {
    return { cardOrder: origin, history };
  }
  return {
    cardOrder: final,
    history: pushEntry(history, { ...board, cardOrder: origin }, { cardOrder: final }),
  };
}
