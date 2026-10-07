import type { Card, List } from "./types";

/**
 * Keep / maybe / cut, worked out. Only an item's own status is stored (set
 * in Linkkit, for now); whether it LOOKS cut is computed here, by the same
 * definition as Linkkit's `looksCut` (its `domain/status.ts`):
 *
 *   An item looks cut when it is cut itself, or when every way into it
 *   comes from an item that looks cut.
 *
 * A board's shape makes that short. The board is Linkkit's start (no way
 * in, never cut), each list's one way in is the board, and each card's one
 * way in is its list. So a list looks cut only when it is cut, and a card
 * when it or its list is. Two plain functions rather than a whole-board
 * pass, so each card works out its own answer from what it already reads.
 */

export function listLooksCut(list: Pick<List, "status">): boolean {
  return list.status === "cut";
}

export function cardLooksCut(card: Pick<Card, "status">, listCut: boolean): boolean {
  return listCut || card.status === "cut";
}
