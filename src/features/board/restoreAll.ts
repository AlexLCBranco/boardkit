import { toast } from "sonner";

import { deserializeBackup } from "../../domain/persistence";
import { useBoardStore } from "../../store/boardStore";
import { forgetStarterBoard, isStarterUntouched, starterBoardId } from "../../store/starterBoard";
import { pickFolderToRead, readBackupsNewestFirst } from "./autoBackup";
import { addBoardsFromBackup } from "./backup";
import { backupDate } from "./recovery";

/**
 * "Restore all boards from a backup folder": the way in at a new address,
 * where this browser's storage starts empty (each address has its own). The
 * newest backup in the folder is read and every board in it added, pictures
 * included. Nothing already here is overwritten: a board whose id is present
 * is skipped, and the starter board is removed only if it was never changed.
 */
export async function restoreAllFromFolder(): Promise<void> {
  const folder = await pickFolderToRead();
  if (!folder) return;
  for await (const backup of readBackupsNewestFirst(folder)) {
    if (deserializeBackup(backup.data)) {
      await restoreAll(backup.data);
      return;
    }
  }
  toast.error(`There are no Boardkit backups in “${folder.name}”.`);
}

/** The same from one backup file, for browsers that cannot open a folder. */
export async function restoreAllFromFile(file: File): Promise<void> {
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    toast.error("That file is not valid JSON.");
    return;
  }
  await restoreAll(data);
}

async function restoreAll(data: unknown): Promise<void> {
  const result = await addBoardsFromBackup(data);
  if (!result) {
    toast.error("That file is not a Boardkit backup.");
    return;
  }
  const { added, skipped, addedIds } = result;
  if (added === 0) {
    toast.info("Every board in that backup is already here.");
    return;
  }

  // The starter is the active board while it is the only one. If it is
  // still exactly as created, it is demo content nobody would miss.
  const store = useBoardStore.getState();
  const starter = starterBoardId();
  let keptStarter: string | null = null;
  if (starter !== null && store.boardId === starter) {
    if (isStarterUntouched(starter)) store.deleteBoard();
    else keptStarter = store.boards.find((board) => board.id === starter)?.name ?? null;
  }
  forgetStarterBoard();
  useBoardStore.getState().switchBoard(addedIds[0]);

  const parts = [`Restored ${added} board${added === 1 ? "" : "s"} from the backup of ${backupDate(data)}.`];
  if (skipped > 0) parts.push(`${skipped} already here ${skipped === 1 ? "was" : "were"} left untouched.`);
  if (keptStarter !== null) parts.push(`“${keptStarter}” was changed, so it was kept too.`);
  toast.success(parts.join(" "));
}
