/**
 * Pure ordering maths. No React, no store, no drag library -- just array
 * operations on ids, so the reorder logic is unit-testable on its own and
 * survives a future change of drag library untouched.
 */

import type { CardId, ListId } from "./types";

/**
 * Returns a new order with `activeId` moved to the position `overId`
 * currently occupies. Both must already be present in `order`; if either is
 * missing, or they are the same id, the input array is returned unchanged
 * (same reference, so callers and selectors can skip on no-op drags).
 */
export function moveWithinList(
  order: readonly CardId[],
  activeId: CardId,
  overId: CardId,
): readonly CardId[] {
  const fromIndex = order.indexOf(activeId);
  const toIndex = order.indexOf(overId);

  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
    return order;
  }

  const next = order.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

/**
 * Moves `activeId` out of `fromListId` and into `toListId`, landing just
 * before `overId` -- or at the end of the destination when `overId` is
 * `null`, which is how a drop on an empty list or open list space is
 * represented (there is no card there to land before).
 *
 * Only the two affected lists get new array references; every other list's
 * `cardOrder` entry keeps its identity, so a column unrelated to the drag
 * does not re-render.
 *
 * Callers are expected to only invoke this for a genuine cross-list move
 * (`fromListId !== toListId`) -- reordering within one list is
 * `moveWithinList`'s job.
 */
export function moveBetweenLists(
  cardOrder: Readonly<Record<ListId, readonly CardId[]>>,
  activeId: CardId,
  fromListId: ListId,
  toListId: ListId,
  overId: CardId | null,
): Readonly<Record<ListId, readonly CardId[]>> {
  const sourceOrder = cardOrder[fromListId].filter((id) => id !== activeId);

  const destinationOrder = cardOrder[toListId].slice();
  const insertAt = overId === null ? destinationOrder.length : destinationOrder.indexOf(overId);
  destinationOrder.splice(insertAt === -1 ? destinationOrder.length : insertAt, 0, activeId);

  return {
    ...cardOrder,
    [fromListId]: sourceOrder,
    [toListId]: destinationOrder,
  };
}

/**
 * The list-order equivalent of `moveWithinList`. Kept as its own function
 * rather than a shared generic: the two operate on differently-branded id
 * arrays for conceptually different things (columns vs. cards inside one),
 * and the bodies are short enough that a generic would cost more to read
 * than it would save.
 */
export function moveList(
  order: readonly ListId[],
  activeId: ListId,
  overId: ListId,
): readonly ListId[] {
  const fromIndex = order.indexOf(activeId);
  const toIndex = order.indexOf(overId);

  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
    return order;
  }

  const next = order.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}
