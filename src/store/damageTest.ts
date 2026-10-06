import { DAMAGE_TEST_BOARD_NAME, breakFirstCard, createDamageTestSave } from "../domain/damageTest";
import { createBoardId } from "../domain/ids";
import { loadPersistedBoard, savePersistedRawBoard } from "./persistBoard";
import { loadPersistedRegistry, savePersistedRegistryNow } from "./persistRegistry";

/**
 * Damages the test board straight in storage and makes it the active board.
 * Must run before `boardStore` is first imported, so the board opens through
 * the normal load path -- repair, set-aside copy, recovery notice -- exactly
 * as a really damaged one would. Only "Damage test" boards are ever damaged.
 *
 * There is only ever one test board: the newest existing one is reused.
 * Healthy, it gets another card broken -- and since it may by now be in an
 * automatic backup, which a brand-new board never is, "Restore from latest
 * backup" has something to find. Still damaged from last time, it is just
 * opened, so its notice can be resolved: an unresolved damaged board pauses
 * every automatic backup. With no test board, a new one is added.
 */
export function plantDamageTestBoard(): void {
  const registry = loadPersistedRegistry();
  const boards = registry?.boards ?? [];
  const existing = boards.findLast((board) => board.name === DAMAGE_TEST_BOARD_NAME);

  let boardId = existing?.id;
  if (boardId) {
    const board = loadPersistedBoard(boardId);
    // `null` means already damaged: leave it as it is.
    const broken = board && breakFirstCard(board);
    if (broken) savePersistedRawBoard(broken, boardId);
  } else {
    boardId = createBoardId();
    savePersistedRawBoard(createDamageTestSave(), boardId);
  }

  const withBoard = existing ? boards : [...boards, { id: boardId, name: DAMAGE_TEST_BOARD_NAME }];
  savePersistedRegistryNow(withBoard, boardId);
}
