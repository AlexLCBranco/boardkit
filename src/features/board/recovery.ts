import { toast } from "sonner";

import { boardContent, deserializeBackup, deserializeBackupImages } from "../../domain/persistence";
import { useBoardStore } from "../../store/boardStore";
import { releaseHeldBoard, savePersistedBoardNow } from "../../store/persistBoard";
import { useRecoveryStore } from "../../store/recoveryStore";
import { findLatestBackupWith } from "./autoBackup";
import { restoreImages } from "./backup";

/**
 * The three ways out of the recovery notice. Every one is an explicit choice,
 * which is what finally allows the board's own key to be written over: until
 * then the damaged original is either set aside or, if that failed, not
 * written over at all (see `store/persistBoard.ts`).
 */

/** "Continue with what was recovered" / "Continue with an empty board": the
    board on screen becomes the saved board. Written now, so a reload does not
    find the damaged text still in place and bring the notice back. The
    original stays in its set-aside key; only when there was no room for that
    copy does this write over it, and the notice asks first. */
export function keepRecoveredBoard(): void {
  const state = useBoardStore.getState();
  releaseHeldBoard(state.boardId);
  savePersistedBoardNow(boardContent(state), state.boardId);
  useRecoveryStore.getState().setDamage(null);
}

/** "Restore from latest backup": the newest file in the automatic-backup
    folder that has this board in it. `found` is that file when the notice
    has already looked it up (to put its date on the button); otherwise it is
    looked up now, from the click, so the browser may ask for the folder. */
export async function restoreFromLatestBackup(found?: { readonly data: unknown } | null): Promise<void> {
  const { boardId } = useBoardStore.getState();
  const backup = found ?? (await findLatestBackupWith(boardId));
  if (!backup) {
    toast.error("No backup in the backup folder has this board in it.");
    return;
  }
  await restoreFrom(backup.data, boardId);
}

/** "Restore from a file…": a backup the user picks, from "Export all boards…"
    or the backup folder. */
export async function restoreFromBackupFile(file: File): Promise<void> {
  const { boardId } = useBoardStore.getState();
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    toast.error("That file is not valid JSON.");
    return;
  }
  await restoreFrom(data, boardId);
}

/**
 * Puts this board's copy from a backup file on screen, matched by board id
 * (an import keeps ids, so a board restored into another browser still
 * matches). Pictures go back first, as on import. One undo step, so the
 * repaired version is still a Ctrl+Z away.
 */
async function restoreFrom(data: unknown, boardId: string): Promise<void> {
  const entry = deserializeBackup(data)?.find((candidate) => candidate.id === boardId);
  if (!entry) {
    toast.error("That backup doesn't have this board in it.");
    return;
  }
  await restoreImages([entry], deserializeBackupImages(data));
  // The pictures take a moment; the user may have switched boards meanwhile.
  if (useBoardStore.getState().boardId !== boardId) return;

  releaseHeldBoard(entry.id);
  useBoardStore.getState().replaceBoardContent(entry.board);
  savePersistedBoardNow(boardContent(useBoardStore.getState()), entry.id);
  useRecoveryStore.getState().setDamage(null);
  toast.success(`Restored “${entry.name}” from the backup of ${backupDate(data)}.`);
}

/** When a backup file was made, for the notice's button and the toast. */
export function backupDate(data: unknown): string {
  const exportedAt = new Date(String((data as { exportedAt?: unknown }).exportedAt));
  return Number.isNaN(exportedAt.getTime())
    ? "an unknown date"
    : exportedAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
