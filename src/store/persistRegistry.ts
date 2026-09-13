import { deserializeRegistry, serializeRegistry, type PersistedRegistryV1 } from "../domain/persistence";
import type { BoardId, BoardSummary } from "../domain/types";

/**
 * The only place that touches `localStorage` for the registry -- the list of
 * boards and which one is active. Mirrors `persistBoard.ts`'s split between
 * "domain owns the shape" and "store owns where/when", kept as its own file
 * because it persists a different document at a different key on a
 * different trigger (any change to the board list or the active id, not to
 * a board's cards).
 */
const STORAGE_KEY = "boardkit:registry";

function writeRegistry(boards: readonly BoardSummary[], activeBoardId: BoardId): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeRegistry(boards, activeBoardId)));
  } catch {
    // Same reasoning as persistBoard.ts: a failed write stays in-memory
    // only, rather than crashing the session.
  }
}

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
