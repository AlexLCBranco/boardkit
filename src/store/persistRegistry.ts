import { deserializeRegistry, serializeRegistry, type PersistedRegistryV1 } from "../domain/persistence";
import type { BoardId, BoardSummary } from "../domain/types";
import { isBoardStored, onBoardStored } from "./persistBoard";
import { useSaveHealth } from "./saveHealthStore";

/**
 * The only place that touches `localStorage` for the registry -- the list of
 * boards and which one is active. Mirrors `persistBoard.ts`'s split between
 * "domain owns the shape" and "store owns where/when", kept as its own file
 * because it persists a different document at a different key on a
 * different trigger (any change to the board list or the active id, not to
 * a board's cards).
 */
const STORAGE_KEY = "boardkit:registry";

/** The list as the app last asked for it, and the ids last actually
    written: a board left out (its content not stored yet) is added the
    moment its content is stored -- see `onBoardStored` below. */
let requested: { boards: readonly BoardSummary[]; activeBoardId: BoardId } | undefined;
let writtenIds = new Set<BoardId>();
let writtenActive: BoardId | undefined;

/**
 * Writes the list -- but only with boards whose content is in storage, so a
 * board whose first save failed is never listed with nothing behind it (a
 * reload would find an entry pointing at nothing). In memory the board is
 * still there; it joins the saved list once its content stores. The active
 * board falls back to one that is stored (the last one written, else the
 * newest). With no board stored at all nothing is written: the next visit
 * then starts like a first one rather than with an empty list.
 */
function writeRegistry(boards: readonly BoardSummary[], activeBoardId: BoardId): void {
  requested = { boards, activeBoardId };
  const stored = boards.filter((board) => isBoardStored(board.id));
  if (stored.length === 0) return;
  const active = stored.some((board) => board.id === activeBoardId)
    ? activeBoardId
    : stored.some((board) => board.id === writtenActive)
      ? (writtenActive as BoardId)
      : stored[stored.length - 1].id;
  let ok = true;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeRegistry(stored, active)));
  } catch {
    // Same reasoning as persistBoard.ts: a failed write stays in-memory
    // only, rather than crashing the session -- and the banner says so.
    ok = false;
  }
  if (ok) {
    writtenIds = new Set(stored.map((board) => board.id));
    writtenActive = active;
  }
  useSaveHealth.getState().report(STORAGE_KEY, ok, () => writeRegistry(boards, activeBoardId));
}

// A board left out of the saved list because its content wasn't stored
// joins it as soon as it is (a retry, or its next edit).
onBoardStored((boardId) => {
  if (requested && !writtenIds.has(boardId) && requested.boards.some((board) => board.id === boardId)) {
    writeRegistry(requested.boards, requested.activeBoardId);
  }
});

export function loadPersistedRegistry(): PersistedRegistryV1 | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? null : deserializeRegistry(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Writes straight away, bypassing the debounce -- for the one-time initial
    migration in `boardStore.ts`. Without this, a registry created on a
    user's very first load (or migrated from a pre-multi-board install)
    would exist only in memory until their next edit, and a fresh random
    board id would be generated on every reload before then, permanently
    losing the link to that board's saved content. */
export function savePersistedRegistryNow(boards: readonly BoardSummary[], activeBoardId: BoardId): void {
  writeRegistry(boards, activeBoardId);
}

const SAVE_DELAY_MS = 400;

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let pending: { boards: readonly BoardSummary[]; activeBoardId: BoardId } | undefined;

export function schedulePersistRegistry(boards: readonly BoardSummary[], activeBoardId: BoardId): void {
  pending = { boards, activeBoardId };
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushPersistRegistry, SAVE_DELAY_MS);
}

/** Writes a still-pending scheduled save immediately, then clears it. See
    `persistBoard.ts`'s `flushPersist` -- same reasoning, called alongside it
    so a fast reload never catches only one of the two documents mid-debounce. */
export function flushPersistRegistry(): void {
  if (!pending) return;
  clearTimeout(saveTimer);
  writeRegistry(pending.boards, pending.activeBoardId);
  pending = undefined;
}
