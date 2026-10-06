import { DAMAGE_TEST_BOARD_NAME, breakFirstCard, createDamageTestSave } from "../domain/damageTest";
import { createBoardId } from "../domain/ids";
import { loadPersistedBoard, savePersistedRawBoard } from "./persistBoard";
import { loadPersistedRegistry, savePersistedRegistryNow } from "./persistRegistry";

/**
 * Damages a test board straight in storage. Must run before `boardStore` is
 * first imported, so the board opens through the normal load path --
 * repair, set-aside copy, recovery notice -- exactly as a really damaged one
 * would. Only "Damage test" boards are ever damaged.
 *
 * If the active board is already a healthy "Damage test" board, one of its
 * cards is broken again. That board may by now be in an automatic backup,
 * which a brand-new board never is, so "Restore from latest backup" has
 * something to find. Otherwise a new test board is added and made active.
 */
export function plantDamageTestBoard(): void {
  const registry = loadPersistedRegistry();
  const active = registry?.boards.find((board) => board.id === registry.activeBoardId);
  if (active?.name === DAMAGE_TEST_BOARD_NAME) {
    const board = loadPersistedBoard(active.id);
    const broken = board && breakFirstCard(board);
    if (broken) {
      savePersistedRawBoard(broken, active.id);
      return;
    }
  }

  const boardId = createBoardId();
  savePersistedRawBoard(createDamageTestSave(), boardId);
  savePersistedRegistryNow([...(registry?.boards ?? []), { id: boardId, name: DAMAGE_TEST_BOARD_NAME }], boardId);
}
