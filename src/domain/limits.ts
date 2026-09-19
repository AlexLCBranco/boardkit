/**
 * Product limits. Boardkit is many boards of short lists, not a few huge
 * ones, so a list has a hard ceiling on how many cards it can hold.
 *
 * The rule lives here, in `domain/`, rather than in a component, because
 * several different actions can put a card into a list -- adding one,
 * dragging one across from another list, restoring one from the trash --
 * and every one of them has to agree on what "full" means.
 */

import type { CardId } from "./types";

export const MAX_CARDS_PER_LIST = 50;

export function isListFull(cardIds: readonly CardId[]): boolean {
  return cardIds.length >= MAX_CARDS_PER_LIST;
}
