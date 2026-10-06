import { DAMAGE_TEST_BOARD_NAME, createDamageTestSave } from "../domain/damageTest";
import { createBoardId } from "../domain/ids";
import { savePersistedRawBoard } from "./persistBoard";
import { loadPersistedRegistry, savePersistedRegistryNow } from "./persistRegistry";

/**
 * Adds a new "Damage test" board with one damaged card and makes it the
 * active board, straight in storage. Must run before `boardStore` is first
 * imported, so the board opens through the normal load path -- repair,
 * set-aside copy, recovery notice -- exactly as a really damaged one would.
 * Other boards are not touched.
 */
export function plantDamageTestBoard(): void {
  const boardId = createBoardId();
  const boards = loadPersistedRegistry()?.boards ?? [];
  savePersistedRawBoard(createDamageTestSave(), boardId);
  savePersistedRegistryNow([...boards, { id: boardId, name: DAMAGE_TEST_BOARD_NAME }], boardId);
}
