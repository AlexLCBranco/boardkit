import { Toaster } from "../components/ui/sonner";
import { BoardCanvas } from "../features/board/BoardCanvas";
import { EmbedBackupStrip } from "../features/board/EmbedBackupStrip";
import { MissingBoardsNotice } from "../features/board/MissingBoardsNotice";
import { RecoveryNotice } from "../features/board/RecoveryNotice";
import { SaveFailedNotice } from "../features/board/SaveFailedNotice";
import { SyncToasts } from "../features/board/SyncToasts";
import { TrashFullDialog } from "../features/board/TrashFullDialog";
import { useEmbedStatus } from "../store/embedStore";
import { useResolvedTheme } from "../store/themeStore";
import styles from "./App.module.css";

/**
 * Embed mode (`?embed=1&id=…`): one board for a frame on the gauntlet
 * canvas. No header (board switcher, theme, trash) and no version badge:
 * only the board, whose own toolbar keeps undo / redo, zoom and search.
 * Every notice still shows, since this frame may be the only place the user
 * sees the board.
 */
export function EmbedApp() {
  const theme = useResolvedTheme();
  const status = useEmbedStatus((s) => s.status);
  if (status !== "ok") return <EmbedGone status={status} />;
  return (
    <div className={styles.app} data-embed-app="">
      <div className={styles.notices}>
        <SaveFailedNotice />
        <RecoveryNotice />
        <MissingBoardsNotice />
        <EmbedBackupStrip />
      </div>
      <main className={styles.main}>
        <BoardCanvas />
      </main>
      <TrashFullDialog />
      <SyncToasts />
      <Toaster position="bottom-center" theme={theme} />
    </div>
  );
}

function EmbedGone({ status }: { readonly status: "missing" | "deleted" }) {
  return (
    <div className={styles.embedGone} role="status" data-testid="embed-gone">
      <p className={styles.embedGoneTitle}>
        {status === "deleted" ? "This board was deleted" : "This board isn’t here"}
      </p>
      <p>
        {status === "deleted"
          ? "It was deleted in another tab or frame."
          : "No Boardkit board in this browser has this frame’s link. It may have been deleted, or made in another browser."}
      </p>
    </div>
  );
}
