import { toast } from "sonner";

import { imageIdOf } from "../../domain/background";
import {
  boardContent,
  deserializeBackup,
  deserializeBackupImages,
  serializeBackup,
  type BackupBoard,
  type BackupFileV1,
  type BackupImage,
} from "../../domain/persistence";
import { hasImage, loadImage, saveImage } from "../../store/imageStore";
import { flushPersist, loadPersistedBoard } from "../../store/persistBoard";
import { useBackupStore } from "../../store/backupStore";
import { useBoardStore } from "../../store/boardStore";

/**
 * Backup and restore. Boards live in one browser's `localStorage`, which
 * disappears if site data is cleared and is invisible to any other browser or
 * device -- a file the user holds is the only copy that survives that.
 */

export interface CollectedBoards {
  readonly boards: BackupBoard[];
  /** Names of boards whose saved content could not be read. They are left out
      of `boards` rather than replaced with an empty board: a backup that
      quietly swaps a board for a blank one is worse than no backup, and with
      automatic rotation it would push every good copy out of the folder. */
  readonly unreadable: string[];
}

/** Every board's content, in registry order. The active board is read from
    the live store rather than storage: its latest edits may still be inside
    the debounce window, and a failed storage write (quota) would otherwise
    silently drop the board the user is looking at from its own backup. */
export function collectBoards(): CollectedBoards {
  flushPersist();
  const state = useBoardStore.getState();
  const boards: BackupBoard[] = [];
  const unreadable: string[] = [];
  for (const { id, name } of state.boards) {
    if (id === state.boardId) {
      boards.push({ id, name, board: boardContent(state) });
      continue;
    }
    const board = loadPersistedBoard(id);
    if (board) boards.push({ id, name, board });
    else unreadable.push(name);
  }
  return { boards, unreadable };
}

/** A picture as base64 text, for JSON: the `data:` URL a reader produces,
    minus its `data:<type>;base64,` prefix. */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** The inverse: text from a backup back into a picture. */
async function base64ToBlob(image: BackupImage): Promise<Blob> {
  return (await fetch(`data:${image.type};base64,${image.data}`)).blob();
}

/** The pictures the boards' backgrounds point at, keyed by image id. One
    shared by several boards (a duplicate) is included once; one that has gone
    missing is left out, and its board falls back to the default background
    when restored, as it does on screen. */
async function collectImages(boards: readonly BackupBoard[]): Promise<Record<string, BackupImage>> {
  const images: Record<string, BackupImage> = {};
  for (const { board } of boards) {
    const id = imageIdOf(board.background);
    if (id === undefined || id in images) continue;
    const blob = await loadImage(id);
    if (blob) {
      images[id] = { type: blob.type, data: await blobToBase64(blob) };
    }
  }
  return images;
}

/** The backup document for a set of boards, stamped with `now`, with the
    background images they use inside it (which is what makes it larger). */
export async function buildBackup(boards: readonly BackupBoard[], now: Date): Promise<BackupFileV1> {
  return serializeBackup(boards, now.toISOString(), await collectImages(boards));
}

/** Downloads every board as a single JSON file. Warns if a board could not be
    read and so is missing from the file. */
export async function exportBackup(): Promise<void> {
  const now = new Date();
  const { boards, unreadable } = collectBoards();
  const backup = await buildBackup(boards, now);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `boardkit-backup-${now.toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  useBackupStore.getState().markBackedUp(now.getTime());
  if (unreadable.length > 0) {
    toast.warning(
      `${listNames(unreadable)} couldn't be read, so ${unreadable.length === 1 ? "it is" : "they are"} not in this backup.`,
    );
  }
}

export interface ImportResult {
  readonly added: number;
  readonly skipped: number;
}

/**
 * Adds the boards in a backup file. Never overwrites: a board whose id is
 * already present is skipped, so importing the same file twice is harmless,
 * and restoring into a cleared browser brings everything back. Throws a
 * readable `Error` when the file is not a usable backup.
 */
export async function importBackup(file: File): Promise<ImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  const entries = deserializeBackup(parsed);
  if (!entries) {
    throw new Error("That file is not a Boardkit backup.");
  }
  const existing = new Set(useBoardStore.getState().boards.map((board) => board.id));
  const fresh = entries.filter((entry) => !existing.has(entry.id));
  await restoreImages(fresh, deserializeBackupImages(parsed));
  useBoardStore.getState().addBoards(fresh);
  return { added: fresh.length, skipped: entries.length - fresh.length };
}

/**
 * Puts back the pictures the imported boards use, before the boards
 * themselves are added, so none is ever on screen pointing at nothing. An
 * image already stored (the same picture, on a board that is already here) is
 * left alone. A picture that cannot be stored costs only that board its
 * background: the board still imports.
 */
async function restoreImages(
  boards: readonly BackupBoard[],
  images: Readonly<Record<string, BackupImage>>,
): Promise<void> {
  for (const { board } of boards) {
    const id = imageIdOf(board.background);
    const image = id === undefined ? undefined : images[id];
    if (id === undefined || image === undefined || (await hasImage(id))) continue;
    try {
      await saveImage(id, await base64ToBlob(image));
    } catch {
      // See above.
    }
  }
}

/** "Week 36", "Week 36 and Sprint", "A, B and C". */
export function listNames(names: readonly string[]): string {
  const quoted = names.map((name) => `“${name}”`);
  return quoted.length <= 1 ? (quoted[0] ?? "") : `${quoted.slice(0, -1).join(", ")} and ${quoted.at(-1)}`;
}
