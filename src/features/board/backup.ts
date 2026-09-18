import {
  deserializeBackup,
  serializeBackup,
  type BackupBoard,
} from "../../domain/persistence";
import { createEmptyBoard } from "../../domain/seed";
import { flushPersist, loadPersistedBoard } from "../../store/persistBoard";
import { useBoardStore } from "../../store/boardStore";

/**
 * Backup and restore. Boards live in one browser's `localStorage`, which
 * disappears if site data is cleared and is invisible to any other browser or
 * device -- a file the user holds is the only copy that survives that.
 */

/** Every board's content, in registry order. The active board is read from
    the live store rather than storage: its latest edits may still be inside
    the debounce window, and a failed storage write (quota) would otherwise
    silently drop the board the user is looking at from its own backup. */
function collectBoards(): BackupBoard[] {
  flushPersist();
  const state = useBoardStore.getState();
  return state.boards.map(({ id, name }) => {
    if (id === state.boardId) {
      const { lists, cards, listOrder, cardOrder, trash, trashedLists } = state;
      return { id, name, board: { lists, cards, listOrder, cardOrder, trash, trashedLists } };
    }
    return { id, name, board: loadPersistedBoard(id) ?? createEmptyBoard() };
  });
}

/** Downloads every board as a single JSON file. */
export function exportBackup(): void {
  const now = new Date();
  const backup = serializeBackup(collectBoards(), now.toISOString());
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `boardkit-backup-${now.toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
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
  useBoardStore.getState().addBoards(fresh);
  return { added: fresh.length, skipped: entries.length - fresh.length };
}
