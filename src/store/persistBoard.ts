import { mergeBoards, sameBoard } from "../domain/merge";
import {
  deserializeBoard,
  isNewerVersion,
  readBoard,
  revOf,
  serializeBoard,
  type BoardRead,
} from "../domain/persistence";
import { createEmptyBoard } from "../domain/seed";
import type { BoardId, BoardState } from "../domain/types";
import { useSaveHealth } from "./saveHealthStore";
import { useSyncNotice } from "./syncNoticeStore";

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
 * Each board as this tab last read or wrote it, with the record's `rev` at
 * that moment: the `base` of the merge in `domain/merge.ts`. A stored
 * `rev` different from this one means another tab (or, on the shared site,
 * Linkkit) saved the board since. `board` is `null` when what was read
 * isn't a clean copy (it was repaired): never skipped as unchanged, and
 * merged as if from an empty board.
 */
const synced = new Map<BoardId, { readonly rev: number; readonly board: BoardState | null }>();

/** Boards another tab deleted while this one had them: never written again
    this session, or a late save would bring a deleted board back. */
const deletedElsewhere = new Set<BoardId>();

/**
 * `mine` caught up with what is stored: when another tab saved the board
 * since this tab last read or wrote it, their version with this tab's own
 * changes re-applied on top (`mergeBoards`), and the user told about any
 * item both changed. Otherwise `mine` itself. A stored record this build
 * can't read is left to the caller, as before.
 */
function caughtUp(boardId: BoardId, mine: BoardState, stored: unknown): BoardState {
  const base = synced.get(boardId);
  if (!base || stored === null || revOf(stored) === base.rev) return mine;
  const read = readBoard(stored);
  if (read.status !== "ok" && read.status !== "repaired") return mine;
  const { board, conflicts } = mergeBoards(base.board ?? createEmptyBoard(), mine, read.board);
  synced.set(boardId, { rev: revOf(stored), board: read.board });
  useSyncNotice.getState().conflicted(conflicts);
  return board;
}

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
  if (heldBoards.has(boardId) || deletedElsewhere.has(boardId)) return true;
  const key = STORAGE_KEY_PREFIX + boardId;
  let ok = true;
  let written = board;
  try {
    // Every write raises the stored record's `rev` by one. Read from
    // storage, not remembered, so it keeps counting up whoever wrote last.
    const stored = storedRecord(key);
    // A newer Boardkit (another tab, after a deploy) stored this board
    // since this tab opened it. Never written over: it reports as a failed
    // save, and a reload brings the newer version.
    if (isNewerVersion(stored)) throw new Error("Saved by a newer Boardkit");
    // The rev check: another tab's save since this tab's last is merged in
    // first, never written over. "Try again" comes through here too.
    written = caughtUp(boardId, board, stored);
    const rev = revOf(stored);
    const base = synced.get(boardId);
    // Nothing new to store (a board just taken from another tab, say): a
    // write would only raise `rev` and make the other tab read it back.
    if (!(base?.board && base.rev === rev && sameBoard(written, base.board))) {
      localStorage.setItem(key, JSON.stringify(serializeBoard(written, rev + 1)));
      synced.set(boardId, { rev: rev + 1, board: written });
    }
  } catch {
    ok = false;
  }
  // Any stored write supersedes an unsaved copy (a transfer included).
  if (ok) unsaved.delete(boardId);
  else if (track) unsaved.set(boardId, written);
  if (track) useSaveHealth.getState().report(key, ok, () => writeBoard(written, boardId));
  if (ok) for (const listener of storedListeners) listener(boardId);
  if (written !== board) for (const listener of mergedListeners) listener(boardId, board, written);
  return ok;
}

const mergedListeners: ((boardId: BoardId, from: BoardState, merged: BoardState) => void)[] = [];

/** Tells `listener` when a write merged in another tab's save: `from` is
    what this tab asked to store, `merged` what was stored (or, if that
    failed, kept to retry). The store (`boardStore.ts`, which imports this
    module) puts it on screen. */
export function onBoardMerged(listener: (boardId: BoardId, from: BoardState, merged: BoardState) => void): void {
  mergedListeners.push(listener);
}

/** What another tab's save means for a board this tab has open. */
export type CatchUp =
  /** Nothing stored since this tab's last read or write, or nothing this
      tab can use (an unreadable record; it is left to the next save). */
  | { readonly kind: "current" }
  /** Theirs, with this tab's unsaved changes re-applied (`mergeBoards`). */
  | { readonly kind: "merged"; readonly board: BoardState }
  /** A newer Boardkit saved it: open it again, read-only. */
  | { readonly kind: "newer" }
  /** Deleted in another tab. */
  | { readonly kind: "deleted" };

/**
 * Called when another tab stored a board (the browser's `storage` event):
 * `mine` is this tab's copy, unsaved changes and all.
 */
export function catchUpBoard(boardId: BoardId, mine: BoardState): CatchUp {
  if (heldBoards.has(boardId) || deletedElsewhere.has(boardId)) return { kind: "current" };
  let stored: unknown;
  try {
    if (localStorage.getItem(STORAGE_KEY_PREFIX + boardId) === null) {
      if (!synced.has(boardId)) return { kind: "current" };
      forgetBoardDeletedElsewhere(boardId);
      return { kind: "deleted" };
    }
    stored = storedRecord(STORAGE_KEY_PREFIX + boardId);
  } catch {
    return { kind: "current" };
  }
  if (isNewerVersion(stored)) return { kind: "newer" };
  const board = caughtUp(boardId, mine, stored);
  return board === mine ? { kind: "current" } : { kind: "merged", board };
}

/**
 * Another tab deleted this board. Its pending save, unsaved copy and failed
 * write are dropped, and nothing writes it again this session: the other
 * tab asked first, so its delete stands.
 */
export function forgetBoardDeletedElsewhere(boardId: BoardId): void {
  deletedElsewhere.add(boardId);
  synced.delete(boardId);
  unsaved.delete(boardId);
  if (pending?.boardId === boardId) {
    clearTimeout(saveTimer);
    pending = undefined;
  }
  useSaveHealth.getState().forget(STORAGE_KEY_PREFIX + boardId);
}

/** A board put back on purpose (restored from a backup) may be written
    again, even if another tab deleted it earlier this session. */
export function allowBoardWrites(boardId: BoardId): void {
  deletedElsewhere.delete(boardId);
}

/** The board id a storage key holds, or `null` for any other key. */
export function boardIdOfKey(key: string): BoardId | null {
  return key.startsWith(STORAGE_KEY_PREFIX) ? (key.slice(STORAGE_KEY_PREFIX.length) as BoardId) : null;
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

/** A board's stored record as parsed JSON, or `null` when there is none or
    it isn't JSON. */
function storedRecord(key: string): unknown {
  const raw = localStorage.getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function revOfText(raw: string): number {
  try {
    return revOf(JSON.parse(raw));
  } catch {
    return 0;
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
      before it was retried. `newer`: nothing is wrong with it, but a newer
      Boardkit saved it, so it opens read-only and is held for the session:
      only a reload (which loads the newer Boardkit) can edit it. */
  readonly status: "repaired" | "unreadable" | "missing" | "newer";
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
  const waiting = unsaved.get(boardId);
  if (waiting) {
    // Another tab may have saved it since: merged in, like any write.
    let board = waiting;
    try {
      board = caughtUp(boardId, waiting, storedRecord(STORAGE_KEY_PREFIX + boardId));
    } catch {
      // Unreadable storage: the unsaved copy is all there is.
    }
    unsaved.set(boardId, board);
    return { board, damage: null };
  }
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY_PREFIX + boardId);
  } catch {
    return { board: null, damage: null };
  }
  if (raw === null) {
    synced.delete(boardId);
    return { board: null, damage: { boardId, status: "missing", lost: 0, setAsideKey: null } };
  }
  const read = parse(raw);
  const rev = revOfText(raw);
  if (read.status === "ok") {
    synced.set(boardId, { rev, board: read.board });
    return { board: read.board, damage: null };
  }
  // Not damaged, so nothing to set aside: the original stays where it is,
  // and holding it means this tab never writes it.
  if (read.status === "newer") {
    heldBoards.add(boardId);
    return { board: read.board, damage: { boardId, status: "newer", lost: 0, setAsideKey: null } };
  }

  synced.set(boardId, { rev, board: null });
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
  synced.delete(boardId);
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
