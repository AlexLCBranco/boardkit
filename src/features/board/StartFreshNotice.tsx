import { useRef, useState, type ChangeEvent } from "react";

import { useBoardStore } from "../../store/boardStore";
import { forgetStarterBoard, starterBoardId } from "../../store/starterBoard";
import { isAutoBackupSupported } from "./autoBackup";
import { restoreAllFromFile, restoreAllFromFolder } from "./restoreAll";
import styles from "./StartFreshNotice.module.css";

/**
 * Shown while the only board is the one a first-ever run created -- which is
 * what Boardkit looks like at a new address, since each address keeps its own
 * storage. Offers bringing every board back from a backup. "Not now" hides it
 * for good; so does having any second board.
 */
export function StartFreshNotice() {
  const [starter, setStarter] = useState(starterBoardId);
  const onlyBoardId = useBoardStore((state) => (state.boards.length === 1 ? state.boards[0].id : null));
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  if (starter === null || onlyBoardId !== starter) return null;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };
  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void run(() => restoreAllFromFile(file));
  };
  const dismiss = () => {
    forgetStarterBoard();
    setStarter(null);
  };
  const canPickFolder = isAutoBackupSupported();

  return (
    <div className={styles.notice} role="status">
      <div className={styles.text}>
        <p className={styles.title}>No boards here yet</p>
        <p className={styles.body}>
          Boardkit keeps boards in the browser, separately for each web address, so this one starts empty. Bring
          your boards back from a backup: every board in it is restored, pictures included. Nothing here is
          replaced.
        </p>
      </div>
      <div className={styles.actions}>
        {canPickFolder && (
          <button
            type="button"
            className={styles.primary}
            disabled={busy}
            onClick={() => void run(restoreAllFromFolder)}
          >
            Restore all boards from a backup folder…
          </button>
        )}
        <button
          type="button"
          className={canPickFolder ? styles.secondary : styles.primary}
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          Restore from a backup file…
        </button>
        <button type="button" className={styles.secondary} disabled={busy} onClick={dismiss}>
          Not now
        </button>
      </div>
      <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={handleFile} />
    </div>
  );
}
