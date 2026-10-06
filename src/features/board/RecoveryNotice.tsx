import { useEffect, useRef, useState, type ChangeEvent } from "react";

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
import { useAutoBackupStatus, useBackupFolderName } from "../../store/selectors";
import { useRecoveryStore } from "../../store/recoveryStore";
import { findLatestBackupWith } from "./autoBackup";
import { backupDate, keepRecoveredBoard, restoreFromBackupFile, restoreFromLatestBackup } from "./recovery";
import styles from "./RecoveryNotice.module.css";

type LatestBackup = Awaited<ReturnType<typeof findLatestBackupWith>>;

/**
 * The banner shown when the board on screen was damaged in storage. It stays
 * until the user picks one of its actions -- there is no plain close button,
 * because each action is also what allows the damaged original to be written
 * over (see `recovery.ts`); until then backups hold this board back.
 */
export function RecoveryNotice() {
  const damage = useRecoveryStore((state) => state.damage);
  const status = useAutoBackupStatus();
  const folderName = useBackupFolderName();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  // The backup "Restore" would use, looked up as soon as the notice shows so
  // the button can say which one. Only while backups are active: the folder
  // is already allowed then, so reading it needs no click.
  const [latest, setLatest] = useState<{ boardId: string; backup: LatestBackup } | null>(null);
  const damagedBoardId = damage?.boardId;
  useEffect(() => {
    if (!damagedBoardId || status !== "active") return;
    let cancelled = false;
    void findLatestBackupWith(damagedBoardId).then((backup) => {
      if (!cancelled) setLatest({ boardId: damagedBoardId, backup });
    });
    return () => {
      cancelled = true;
    };
  }, [damagedBoardId, status]);

  if (!damage) return null;

  const hasFolder = status === "active" || status === "needs-permission" || status === "folder-error";
  // `undefined` while not looked up yet, `null` when no backup has the board.
  const found = latest?.boardId === damage.boardId ? latest.backup : undefined;
  // While backups are active the button waits for the lookup, then names
  // the backup it will use -- or is replaced by a sentence saying there is
  // none, rather than offering a button that can only fail. A folder that
  // still needs a click is offered as is; the click does the lookup.
  const showLatest = status === "active" ? Boolean(found) : hasFolder;
  const noBackupHasBoard = status === "active" && found === null;
  const keepLabel = damage.status === "repaired" ? "Continue with what was recovered" : "Continue with an empty board";

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
    if (file) void run(() => restoreFromBackupFile(file));
  };
  // With the original set aside, continuing loses nothing, so it needs no
  // question. Without that copy it writes over the only one there is.
  const handleKeep = () => {
    if (damage.setAsideKey) keepRecoveredBoard();
    else setIsConfirmOpen(true);
  };

  return (
    <div className={styles.notice} role="alert">
      <div className={styles.text}>
        <p className={styles.title}>
          {damage.status === "repaired"
            ? "Part of this board’s saved data was damaged"
            : "This board’s saved data couldn’t be read"}
        </p>
        <p className={styles.body}>
          {damage.status === "repaired"
            ? `Everything that could still be read is shown${lostClause(damage.lost)}.`
            : "It is shown empty."}{" "}
          {damage.setAsideKey
            ? "The damaged original is kept in this browser either way, untouched."
            : "There wasn’t room to keep a copy of the original, so changes to this board aren’t saved until you choose below."}{" "}
          {noBackupHasBoard &&
            `None of the backups in “${folderName ?? "the backup folder"}” has this board yet, so there is none to restore. `}
          {hasFolder
            ? noBackupHasBoard
              ? "Until you choose, it’s left out of new backups; other boards are backed up as usual."
              : "Until you choose, new backups keep this board’s last backed-up version; other boards are backed up as usual."
            : "Automatic backups aren’t set up, so the only backups are files you saved with “Export all boards…”."}
        </p>
      </div>
      <div className={styles.actions}>
        {showLatest && (
          <button
            type="button"
            className={styles.primary}
            disabled={busy}
            onClick={() => void run(() => restoreFromLatestBackup(found))}
          >
            {found ? `Restore the backup from ${backupDate(found.data)}` : "Restore from latest backup"}
          </button>
        )}
        <button
          type="button"
          className={showLatest ? styles.secondary : styles.primary}
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          Restore from a backup file…
        </button>
        <button type="button" className={styles.secondary} disabled={busy} onClick={handleKeep}>
          {keepLabel}
        </button>
      </div>
      <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={handleFile} />
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace the damaged original?</AlertDialogTitle>
            <AlertDialogDescription>
              There wasn’t room in this browser to keep a copy of it. Continuing saves the board you see now in
              its place, and the original can’t be recovered afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={keepRecoveredBoard}>
              Replace original
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function lostClause(lost: number): string {
  if (lost === 0) return "";
  return `; ${lost} damaged ${lost === 1 ? "entry" : "entries"} couldn’t be recovered`;
}
