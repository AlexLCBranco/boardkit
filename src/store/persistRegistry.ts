import { mergeBoardLists, sameValue, type MergeConflict } from "../domain/merge";
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
 * The stored list as this tab last read or wrote it: the `base` for
 * merging another tab's changes to it (`mergeBoardLists`). The list has no
 * `rev`; it is small enough to compare whole. `undefined` until read.
 */
let synced: readonly BoardSummary[] | undefined;

/** The stored list, or `null` when there is none or it can't be read. */
function storedRegistry(): PersistedRegistryV1 | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? null : deserializeRegistry(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** `mine` with another tab's changes to the stored list merged in, when
    there are any since this tab last read or wrote it. */
function caughtUp(mine: readonly BoardSummary[], stored: PersistedRegistryV1 | null): BoardListCatchUp | null {
  if (!stored || !synced || sameValue(stored.boards, synced)) return null;
  const merged = mergeBoardLists(synced, mine, stored.boards);
  synced = stored.boards;
  return merged;
}

export interface BoardListCatchUp {
  readonly boards: readonly BoardSummary[];
  readonly conflicts: readonly MergeConflict[];
}

const mergedListeners: ((from: readonly BoardSummary[], merged: BoardListCatchUp) => void)[] = [];

/** Tells `listener` when a write merged in another tab's change to the list,
    so the store can show the merged list. `from` is the list this tab asked
    to store. */
export function onBoardListMerged(
  listener: (from: readonly BoardSummary[], merged: BoardListCatchUp) => void,
): void {
  mergedListeners.push(listener);
}

/** Called when another tab stored the list (the browser's `storage`
    event): `mine` merged with it, or `null` when nothing changed. */
export function catchUpBoardList(mine: readonly BoardSummary[]): BoardListCatchUp | null {
  return caughtUp(mine, storedRegistry());
}

/**
 * Writes the list -- but only with boards whose content is in storage, so a
 * board whose first save failed is never listed with nothing behind it (a
 * reload would find an entry pointing at nothing). In memory the board is
 * still there; it joins the saved list once its content stores. The active
 * board falls back to one that is stored (the last one written, else the
 * newest). With no board stored at all nothing is written: the next visit
 * then starts like a first one rather than with an empty list.
 */
function writeRegistry(mine: readonly BoardSummary[], activeBoardId: BoardId): void {
  // Another tab changed the list since: theirs, with this tab's changes on top.
  const current = storedRegistry();
  const merged = caughtUp(mine, current);
  const boards = merged ? merged.boards : mine;
  requested = { boards, activeBoardId };
  if (merged) for (const listener of mergedListeners) listener(mine, merged);
  const stored = boards.filter((board) => isBoardStored(board.id));
  if (stored.length === 0) return;
  const active = stored.some((board) => board.id === activeBoardId)
    ? activeBoardId
    : stored.some((board) => board.id === writtenActive)
      ? (writtenActive as BoardId)
      : stored[stored.length - 1].id;
  let ok = true;
  try {
    // Unchanged: not written, so the other tab isn't sent a storage event.
    // The open board counts as unchanged while it is still the one this tab
    // last wrote: taking in another tab's list must not overwrite which board
    // that tab opened last (the one a reload opens).
    const sameActive = current?.activeBoardId === active || active === writtenActive;
    if (!(current && sameActive && sameValue(current.boards, stored))) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeRegistry(stored, active)));
    }
    synced = stored;
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

/** Whether a storage key is the board list's. */
export const isBoardListKey = (key: string): boolean => key === STORAGE_KEY;

/** The stored list, read at startup; it becomes the base for merging. */
export function loadPersistedRegistry(): PersistedRegistryV1 | null {
  const registry = storedRegistry();
  if (registry) {
    synced ??= registry.boards;
    writtenActive ??= registry.activeBoardId;
  }
  return registry;
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
