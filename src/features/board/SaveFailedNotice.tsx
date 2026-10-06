import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { boardContent } from "../../domain/persistence";
import { useBoardStore } from "../../store/boardStore";
import { flushPersist, savePersistedBoardNow } from "../../store/persistBoard";
import { savePersistedRegistryNow } from "../../store/persistRegistry";
import { useSaveHealth } from "../../store/saveHealthStore";
import { useEmptyListTrash, useEmptyTrash, useTrashCount, useTrashedListsCount } from "../../store/selectors";
import { exportBackup } from "./backup";
// The same banner look as the damaged-board notice: both are "stop and read
// this" strips under the header.
import styles from "./RecoveryNotice.module.css";

/**
 * Makes every failed write again -- boards that aren't open too (a new,
 * duplicated or imported board), with the content each last tried to store
 * -- then writes the board on screen and the board list as they are now, so
 * the open board's latest state is what ends up saved.
 */
function trySavingAgain(): void {
  flushPersist();
  useSaveHealth.getState().retryAll();
  const state = useBoardStore.getState();
  savePersistedBoardNow(boardContent(state), state.boardId);
  savePersistedRegistryNow(state.boards, state.boardId);
}

/**
 * Shown while saving fails (the browser's storage for the site is full, or
 * blocked). Not a toast: it stays until every failing write has gone through
 * again, since until then the latest changes live only in this tab. Emptying
 * the trash makes room and is itself a change, so its save is the retry.
 */
export function SaveFailedNotice() {
  const failing = useSaveHealth((s) => s.failing.length > 0);
  const trashedCards = useTrashCount();
  const trashedLists = useTrashedListsCount();
  const emptyTrash = useEmptyTrash();
  const emptyListTrash = useEmptyListTrash();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  if (!failing) return null;

  const trashIsEmpty = trashedCards === 0 && trashedLists === 0;
  const inTrash = [
    trashedCards > 0 && `${trashedCards} card${trashedCards === 1 ? "" : "s"}`,
    trashedLists > 0 && `${trashedLists} list${trashedLists === 1 ? "" : "s"} (with their cards)`,
  ]
    .filter(Boolean)
    .join(" and ");

  return (
    <div className={styles.notice} role="alert">
      <div className={styles.text}>
        <p className={styles.title}>Changes aren't being saved</p>
        <p className={styles.body}>
          The browser's storage for this site is full, so your latest changes exist only in this
          tab. Keep it open until this goes away (switching boards is fine). Back up now, then
          make room: empty the trash, or delete boards you no longer need.
        </p>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={() => void exportBackup()}>
          Back up now
        </button>
        <button
          type="button"
          className={styles.secondary}
          disabled={trashIsEmpty}
          title={trashIsEmpty ? "This board's trash is already empty" : undefined}
          onClick={() => setIsConfirmOpen(true)}
        >
          Empty trash…
        </button>
        <button type="button" className={styles.secondary} onClick={trySavingAgain}>
          Try again
        </button>
      </div>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Empty this board's trash?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently erases {inTrash} from this board's trash. Other boards' trash isn't
              touched: open a board to empty its own.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                emptyTrash();
                emptyListTrash();
              }}
            >
              Empty trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
