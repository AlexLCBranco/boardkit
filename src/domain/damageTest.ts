import { serializeBoard } from "./persistence";
import { createBoard } from "./seed";
import type { BoardState } from "./types";

/**
 * Saved boards with exactly one damaged card, for trying the recovery
 * notice without hand-editing storage (`?damage-test`, see `main.tsx`).
 * Pure: returns what would be saved.
 *
 * The card is replaced by a number -- an entry that is not an object is the
 * one kind of damage `repair.ts` cannot salvage -- so the notice reports one
 * lost entry and every other card loads as it was.
 */
export const DAMAGE_TEST_BOARD_NAME = "Damage test";

/** A new test board's save: five cards, the first one broken. */
export function createDamageTestSave(): unknown {
  const board = createBoard([
    { title: "To try", cards: ["This card will be damaged", "Survives", "Survives too"] },
    { title: "Also here", cards: ["Fine", "Fine as well"] },
  ]);
  return breakFirstCard(board);
}

/** `board`'s save with its first shown card broken, or `null` if no list
    has a card to break. Used again on an existing test board, which by then
    may be in a backup, so restoring from the latest backup can be tried. */
export function breakFirstCard(board: BoardState): unknown {
  const brokenId = board.listOrder.map((listId) => board.cardOrder[listId][0]).find(Boolean);
  if (!brokenId) return null;
  const saved = serializeBoard(board);
  return { ...saved, board: { ...saved.board, cards: { ...saved.board.cards, [brokenId]: 42 } } };
}
