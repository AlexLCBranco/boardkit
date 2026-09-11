import { deserializeBoard, serializeBoard } from "../domain/persistence";
import type { BoardState } from "../domain/types";

/**
 * The only place that touches `localStorage`. `domain/persistence.ts` owns
 * the data shape and its validation; this module owns where it lives and
 * when it gets written.
 */
const STORAGE_KEY = "boardkit:board";
const SAVE_DELAY_MS = 400;

export function loadPersistedBoard(): BoardState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? null : deserializeBoard(JSON.parse(raw));
  } catch {
    return null;
  }
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Debounced so a run of fast changes -- typing a title, a multi-card drag --
 * writes once after things settle, rather than hitting storage on every
 * store update.
 */
export function schedulePersist(board: BoardState): void {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeBoard(board)));
    } catch {
      // Storage can fail -- quota, private browsing -- without that being
      // fatal: the board keeps working in memory for the rest of the session.
    }
  }, SAVE_DELAY_MS);
}
