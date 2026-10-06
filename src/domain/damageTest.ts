import { serializeBoard } from "./persistence";
import { createBoard } from "./seed";

/**
 * A saved board with exactly one damaged card, for trying the recovery
 * notice without hand-editing storage (`?damage-test`, see `main.tsx`).
 * Pure: returns what would be saved.
 *
 * The card is replaced by a number -- an entry that is not an object is the
 * one kind of damage `repair.ts` cannot salvage -- so the notice reports one
 * lost entry and the other four cards load as they were.
 */
export const DAMAGE_TEST_BOARD_NAME = "Damage test";

export function createDamageTestSave(): unknown {
  const board = createBoard([
    { title: "To try", cards: ["This card will be damaged", "Survives", "Survives too"] },
    { title: "Also here", cards: ["Fine", "Fine as well"] },
  ]);
  const saved = serializeBoard(board);
  const brokenId = board.cardOrder[board.listOrder[0]][0];
  return { ...saved, board: { ...saved.board, cards: { ...saved.board.cards, [brokenId]: 42 } } };
}
