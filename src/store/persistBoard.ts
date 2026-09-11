import { deserializeBoard, serializeBoard } from "../domain/persistence";
import type { BoardId, BoardState } from "../domain/types";

/**
 * The only place that touches `localStorage` for a board's own content.
 * `domain/persistence.ts` owns the data shape and its validation; this
 * module owns where it lives and when it gets written.
 *
 * Keyed by board id rather than one fixed key, now that a board is one of
 * several -- see `persistRegistry.ts` for the separate, much smaller
 * document that tracks which boards exist.
 */
const STORAGE_KEY_PREFIX = "boardkit:board:";

function writeBoard(board: BoardState, boardId: BoardId): void {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + boardId, JSON.stringify(serializeBoard(board)));
  } catch {
    // Storage can fail -- quota, private browsing -- without that being
    // fatal: the board keeps working in memory for the rest of the session.
  }
}

export function loadPersistedBoard(boardId: BoardId): BoardState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + boardId);
    return raw === null ? null : deserializeBoard(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Writes straight away, bypassing the debounce -- for the one-time initial
    migration in `boardStore.ts`, where there is no later edit to eventually
    flush this through the normal debounced path. */
export function savePersistedBoardNow(board: BoardState, boardId: BoardId): void {
  writeBoard(board, boardId);
}

const SAVE_DELAY_MS = 400;

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let pending: { board: BoardState; boardId: BoardId } | undefined;

/**
 * Debounced so a run of fast changes -- typing a title, a multi-card drag --
 * writes once after things settle, rather than hitting storage on every
 * store update.
 */
export function schedulePersist(board: BoardState, boardId: BoardId): void {
  pending = { board, boardId };
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushPersist, SAVE_DELAY_MS);
}

/**
 * Writes a still-pending scheduled save immediately, then clears it. Called
 * before switching or creating a board: the debounce timer is a single
 * shared one, so without a flush, switching away within the 400ms window
 * would cancel the outgoing board's save and silently drop its latest edits
 * rather than write them under its own key.
 */
export function flushPersist(): void {
  if (!pending) return;
  clearTimeout(saveTimer);
  writeBoard(pending.board, pending.boardId);
  pending = undefined;
}

/**
 * The pre-multi-board storage key. Read once, at startup, to migrate a
 * single-board install into the registry -- see `boardStore.ts`'s initial
 * state. Never written to again afterward.
 */
const LEGACY_STORAGE_KEY = "boardkit:board";

export function loadLegacyPersistedBoard(): BoardState | null {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    return raw === null ? null : deserializeBoard(JSON.parse(raw));
  } catch {
    return null;
  }
}
