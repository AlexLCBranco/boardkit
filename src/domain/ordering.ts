/**
 * Pure ordering maths. No React, no store, no drag library -- just array
 * operations on ids, so the reorder logic is unit-testable on its own and
 * survives a future change of drag library untouched.
 */

import type { CardId } from "./types";

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
