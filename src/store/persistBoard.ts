import { deserializeBoard, readBoard, serializeBoard, type BoardRead } from "../domain/persistence";
import type { BoardId, BoardState } from "../domain/types";
import { useSaveHealth } from "./saveHealthStore";

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

/** Boards whose damaged original could not be set aside (see
    `openPersistedBoard`). Nothing is written over them this session until
    the user picks what to keep: the original is still only in its own key. */
const heldBoards = new Set<BoardId>();

/**
 * Boards whose latest save failed, as they were meant to be saved. Until a
 * retry stores them, reading a board looks here first, so switching to one
 * (or backing it up) gets its real content in this session instead of the
 * stale stored copy -- or, for a board whose first save failed, nothing.
 */
const unsaved = new Map<BoardId, BoardState>();

/**
 * Writes a board; `false` if storage refused it. Storage can fail -- quota,
 * private browsing -- without that being fatal: the board keeps working in
 * memory. But never silently: the result goes to `saveHealthStore.ts`, whose
 * banner stays up until this key saves again. `track` false is for a write
 * the caller reports itself and that nothing would retry (a transfer into
 * another board), so it can't hold the banner up for good.
 */
function writeBoard(board: BoardState, boardId: BoardId, track = true): boolean {
  // Held on purpose (see `heldBoards`), not a failure: RecoveryNotice is
  // already asking the user about this board.
  if (heldBoards.has(boardId)) return true;
  const key = STORAGE_KEY_PREFIX + boardId;
  let ok = true;
  try {
    localStorage.setItem(key, JSON.stringify(serializeBoard(board)));
  } catch {
    ok = false;
  }
  // Any stored write supersedes an unsaved copy (a transfer included).
  if (ok) unsaved.delete(boardId);
  else if (track) unsaved.set(boardId, board);
  if (track) useSaveHealth.getState().report(key, ok, () => writeBoard(board, boardId));
  if (ok) for (const listener of storedListeners) listener(boardId);
  return ok;
}

const storedListeners: ((boardId: BoardId) => void)[] = [];

/** Tells `listener` each time a board's content is stored. How the saved
    board list (`persistRegistry.ts`, which imports this module, so it can't
    be called from here directly) adds a board whose first save failed once
    a retry stores it. */
export function onBoardStored(listener: (boardId: BoardId) => void): void {
  storedListeners.push(listener);
}

/** Whether a board's content is in storage right now (an unsaved copy in
    memory doesn't count). The saved board list names only these. */
export function isBoardStored(boardId: BoardId): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_PREFIX + boardId) !== null;
  } catch {
    // Unreadable storage: don't drop boards from the list over it.
    return true;
  }
}

function parse(raw: string): BoardRead {
  try {
    return readBoard(JSON.parse(raw));
  } catch {
    return { status: "unreadable" };
  }
}

/**
 * A board that is not the one on screen, read for search, backup, a
 * transfer or the image sweep. Only a healthy board comes back: a damaged
 * one is `null`, like a missing one, so none of those can act on a partial
 * copy -- a transfer would write it back over the original. It gets repaired
 * when the user opens it (`openPersistedBoard`), where they are told.
 */
export function loadPersistedBoard(boardId: BoardId): BoardState | null {
  const pending = unsaved.get(boardId);
  if (pending) return pending;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + boardId);
    if (raw === null) return null;
    const read = parse(raw);
    return read.status === "ok" ? read.board : null;
  } catch {
    return null;
  }
}

/** Whether a board's content exists: stored, or waiting in this session for
    a save to go through. `false` for a board the list names means its
    content was lost (see `openPersistedBoard`). */
export function hasPersistedBoard(boardId: BoardId): boolean {
  return unsaved.has(boardId) || isBoardStored(boardId);
}

/** A board's saved text exactly as stored, or `null` -- for telling whether
    it has been written since (`starterBoard.ts`). */
export function persistedBoardText(boardId: BoardId): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_PREFIX + boardId);
  } catch {
    return null;
  }
}

/** What was wrong with a board that was just opened. */
export interface BoardDamage {
  readonly boardId: BoardId;
  /** `repaired`: some of it was recovered. `unreadable`: none of it.
      `missing`: the board list names it but nothing is stored for it at all
      -- most likely its save failed (storage full) and the tab closed
      before it was retried. */
  readonly status: "repaired" | "unreadable" | "missing";
  /** Entries that could not be read, when `repaired`. */
  readonly lost: number;
  /** Where the original now sits, untouched; `null` if it could not be
      copied there (storage full), in which case the board is held -- not
      saved -- until the user chooses. Always `null` when `missing`: there
      is no original, so nothing is held either. */
  readonly setAsideKey: string | null;
}

/**
 * Reads the board about to go on screen. Unlike `loadPersistedBoard`, a
 * damaged board still opens, repaired as far as it goes -- but first its
 * saved text is copied, exactly as it was, to a key of its own. The next
 * save overwrites the board's own key, so without that copy "repaired"
 * would quietly mean "whatever the repair kept".
 *
 * `board` is `null` when there is nothing saved, or nothing salvageable;
 * `damage` tells the two apart. Nothing saved is itself `missing` damage:
 * every board the list names is written the moment it is made, so a board
 * with no content lost it -- and the user is told rather than shown an
 * empty board as if nothing happened.
 */
export function openPersistedBoard(boardId: BoardId): { board: BoardState | null; damage: BoardDamage | null } {
  // Its latest save failed this session: that content is the real board.
  const pending = unsaved.get(boardId);
  if (pending) return { board: pending, damage: null };
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY_PREFIX + boardId);
  } catch {
    return { board: null, damage: null };
  }
  if (raw === null) return { board: null, damage: { boardId, status: "missing", lost: 0, setAsideKey: null } };
  const read = parse(raw);
  if (read.status === "ok") return { board: read.board, damage: null };

  const setAsideKey = setAside(boardId, raw);
  if (setAsideKey === null) heldBoards.add(boardId);
  return {
    board: read.status === "repaired" ? read.board : null,
    damage: {
      boardId,
      status: read.status,
      lost: read.status === "repaired" ? read.report.lost : 0,
      setAsideKey,
    },
  };
}

const SET_ASIDE_PREFIX = "boardkit:damaged:";

/**
 * Copies a damaged board's saved text to `boardkit:damaged:<id>`, and
 * returns that key. Opening the same damaged board again finds its copy
 * already there and adds nothing; different damage to the same board gets a
 * timestamped key of its own, so no earlier copy is ever overwritten.
 * `null` if storage refused the write.
 */
function setAside(boardId: BoardId, raw: string): string | null {
  const base = SET_ASIDE_PREFIX + boardId;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if ((key === base || key?.startsWith(base + ":")) && localStorage.getItem(key) === raw) {
        return key;
      }
    }
    const key = localStorage.getItem(base) === null ? base : `${base}:${Date.now()}`;
    localStorage.setItem(key, raw);
    return key;
  } catch {
    return null;
  }
}

/** Removes every set-aside copy whose board `isGone`. Keys are
    `boardkit:damaged:<id>` or `boardkit:damaged:<id>:<time>`. */
function removeSetAside(isGone: (boardId: string) => boolean): void {
  const doomed: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(SET_ASIDE_PREFIX) && isGone(key.slice(SET_ASIDE_PREFIX.length).split(":")[0])) {
      doomed.push(key);
    }
  }
  for (const key of doomed) localStorage.removeItem(key);
}

/** Startup tidy-up: drops set-aside copies left by boards that no longer
    exist (deleted before deleting took their copies with them). */
export function removeOrphanedSetAside(boardIds: readonly BoardId[]): void {
  try {
    removeSetAside((owner) => !boardIds.includes(owner as BoardId));
  } catch {
    // Storage unavailable: nothing to tidy.
  }
}

/** The user has chosen what this board should be (kept the repair, or
    restored a backup): saving it may overwrite the original again. */
export function releaseHeldBoard(boardId: BoardId): void {
  heldBoards.delete(boardId);
}

/** Writes `saved` as a board's content exactly as given, unvalidated -- only
    for planting the damage-test board (`store/damageTest.ts`). */
export function savePersistedRawBoard(saved: unknown, boardId: BoardId): void {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + boardId, JSON.stringify(saved));
  } catch {
    // Same as `writeBoard`.
  }
}

/** Removes a board's saved content. Callers must `flushPersist()` first: a
    still-pending save for this board would otherwise fire afterwards and
    write the deleted board straight back. */
export function removePersistedBoard(boardId: BoardId): void {
  try {
    localStorage.removeItem(STORAGE_KEY_PREFIX + boardId);
    // Its set-aside damaged originals go too: with the board gone they can
    // never be used, and would only take up storage.
    removeSetAside((owner) => owner === boardId);
  } catch {
    // Nothing useful to do: the registry no longer lists it, so it is
    // unreachable whether or not this succeeds.
  }
  unsaved.delete(boardId);
  useSaveHealth.getState().forget(STORAGE_KEY_PREFIX + boardId);
}

/** Writes straight away, bypassing the debounce -- for the one-time initial
    migration in `boardStore.ts`, where there is no later edit to eventually
    flush this through the normal debounced path. */
export function savePersistedBoardNow(board: BoardState, boardId: BoardId): boolean {
  return writeBoard(board, boardId);
}

/** Writes another board's content straight away (a transfer into it) and
    says whether it was stored. Not tracked for the banner: the caller tells
    the user itself, and nothing would ever retry this write. */
export function saveOtherBoardNow(board: BoardState, boardId: BoardId): boolean {
  return writeBoard(board, boardId, false);
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
