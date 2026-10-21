import { useEffect } from "react";
import { createPortal } from "react-dom";

import { flushPersist } from "../../store/persistBoard";
import { useSaveHealth } from "../../store/saveHealthStore";
import styles from "./SaveFailedBanner.module.css";

/**
 * The whiteboard's "Changes aren't being saved": Boardkit's own banner
 * (`features/board/SaveFailedNotice.tsx`) for the gauntlet whiteboard,
 * whose board edits go through the same saving (`useSaveHealth`). Shown
 * while any board write fails (the site's storage full, or blocked), with
 * "Try again" and the browser's "Leave site?" prompt; gone by itself once
 * every failing write has gone through. Its trash and board-list buttons
 * stay in Boardkit: the whiteboard has neither, and its board list is not
 * this page's to write.
 */
export function SaveFailedBanner() {
  const failing = useSaveHealth((s) => s.failing.length > 0);
  useEffect(() => {
    if (!failing) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [failing]);
  if (!failing) return null;
  return createPortal(
    <div className={styles.banner} role="alert" data-save-failed="">
      <div>
        <p className={styles.title}>Board changes aren't being saved</p>
        <p className={styles.body}>
          The browser's storage for this site is full, so your latest board changes exist only in this tab. Keep it
          open until this goes away. Make room (delete boards you no longer need in Boardkit, or empty a board's
          trash there), then try again.
        </p>
      </div>
      <button
        type="button"
        className={styles.retry}
        onClick={() => {
          // Every failed write again, each with what it last tried to store
          // (the board being edited included, after its waiting save).
          flushPersist();
          useSaveHealth.getState().retryAll();
        }}
      >
        Try again
      </button>
    </div>,
    document.body,
  );
}
