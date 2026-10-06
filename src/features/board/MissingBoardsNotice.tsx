import { useState } from "react";

import { hasPersistedBoard } from "../../store/persistBoard";
import { useSaveHealth } from "../../store/saveHealthStore";
import { useBoardId, useBoards, useSwitchBoard } from "../../store/selectors";
import { listNames } from "./backup";
import styles from "./RecoveryNotice.module.css";

/**
 * Names boards in the list whose content isn't in storage, other than the
 * one on screen (that one gets the recovery notice, with its restore
 * buttons). Without this, such a board would only be found by opening it.
 * Opening one from here brings up that notice. "Not now" hides this until
 * the next visit; the boards stay in the list either way.
 */
export function MissingBoardsNotice() {
  const boards = useBoards();
  const activeId = useBoardId();
  const switchBoard = useSwitchBoard();
  // Not read: subscribed only so a retry that finally stores a board
  // re-renders this and the list is looked at again. Otherwise it renders
  // only when the board list or the open board changes, which is when
  // storage is read below.
  useSaveHealth((s) => s.failing);
  const [dismissed, setDismissed] = useState(false);

  const missing = boards.filter((board) => board.id !== activeId && !hasPersistedBoard(board.id));

  if (dismissed || missing.length === 0) return null;
  const one = missing.length === 1;

  return (
    <div className={styles.notice} role="alert">
      <div className={styles.text}>
        <p className={styles.title}>{one ? "A board’s content is missing" : `${missing.length} boards’ content is missing`}</p>
        <p className={styles.body}>
          {listNames(missing.map((board) => board.name))} {one ? "is" : "are"} in your list of boards, but nothing
          for {one ? "it" : "them"} is in this browser’s storage. Most likely a save failed because storage was
          full and the tab closed before it was retried. Open {one ? "it" : "one"} to restore it from a backup.
        </p>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={() => switchBoard(missing[0].id)}>
          Open “{missing[0].name}”
        </button>
        <button type="button" className={styles.secondary} onClick={() => setDismissed(true)}>
          Not now
        </button>
      </div>
    </div>
  );
}
