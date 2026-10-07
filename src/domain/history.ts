import { mergeBoards, shareUnchanged, type MergeConflict } from "./merge";
import type { BoardState } from "./types";

/**
 * Undo/redo over a stack of inverse operations, not full state snapshots.
 *
 * Every board action already produces a *patch*: a partial `BoardState`
 * holding only the slices it touched, with every untouched slice left at its
 * existing reference (that is the store's normalisation rule, applied for
 * performance). That patch is, almost for free, also its own undo record --
 * capture the same slices' values from just before the action ran, and
 * reapplying them later needs no per-action knowledge of what changed or how
 * to reverse it. A snapshot-per-step approach would instead copy the whole
 * board on every keystroke, most of it unchanged.
 *
 * Changes from outside -- another tab, or Linkkit for a board linked to one
 * of its maps (Linkkit's plan, step 27) -- don't clear the history. A step
 * whose slices are still exactly the ones it left is undone by putting its
 * old slices back, as always. Otherwise something came in since, and
 * putting whole slices back would quietly erase it, so the step is undone
 * as a merge (`mergeBoards`): base = the board as the step left it, mine =
 * as it was before the step, theirs = the board now. Only the cards, lists
 * or background the step changed go back; everything else stays as it is
 * now. An item the step changed that was also changed from outside is a
 * conflict: the undo is refused, and that step and every older one are
 * dropped (skipping just it could make a board that never existed). Redo
 * the same way round.
 */
export type BoardPatch = Partial<BoardState>;

export interface HistoryEntry {
  readonly before: BoardPatch;
  readonly after: BoardPatch;
}

export interface History {
  readonly past: readonly HistoryEntry[];
  readonly future: readonly HistoryEntry[];
}

export const EMPTY_HISTORY: History = { past: [], future: [] };

/** Bounded so a long session's undo stack cannot grow without limit. */
const HISTORY_LIMIT = 100;

function isNoOp(before: BoardPatch, after: BoardPatch): boolean {
  return (Object.keys(after) as (keyof BoardPatch)[]).every((key) => before[key] === after[key]);
}

/**
 * Records one step. A step where every touched slice kept its previous
 * reference -- a drag that resolved back to its own position, for example --
 * is not a real change and is dropped rather than filling the stack with
 * no-op undos. Any genuine step clears `future`: redo only ever replays
 * history that undo just walked back through.
 */
export function pushEntry(history: History, before: BoardPatch, after: BoardPatch): History {
  if (isNoOp(before, after)) {
    return history;
  }
  return { past: [...history.past, { before, after }].slice(-HISTORY_LIMIT), future: [] };
}

/**
 * An undo or redo taken: the new history, and the patch to apply to the
 * board. Refused when `conflicts` isn't empty (items changed from outside
 * since): `patch` is then empty, and `history` has lost the refused step and
 * everything behind it.
 */
export interface Step {
  readonly history: History;
  readonly patch: BoardPatch;
  readonly conflicts: readonly MergeConflict[];
}

/** The patch turning `from`'s slices back into `to`'s on `board`: `to`
    itself while `board` still holds `from`'s very slices, else the whole
    board merged item by item (see the file comment). */
function apply(
  board: BoardState,
  from: BoardPatch,
  to: BoardPatch,
): { patch: BoardPatch; conflicts: readonly MergeConflict[] } {
  const keys = Object.keys(from) as (keyof BoardPatch)[];
  if (keys.every((key) => board[key] === from[key])) return { patch: to, conflicts: [] };
  const merged = mergeBoards({ ...board, ...from }, { ...board, ...to }, board);
  // Unchanged objects kept, so only what the step puts back re-renders.
  return { patch: shareUnchanged(board, merged.board), conflicts: merged.conflicts };
}

/** `board` is the open board's content as it is now. */
export function stepUndo(history: History, board: BoardState): Step | null {
  const entry = history.past.at(-1);
  if (!entry) {
    return null;
  }
  const done = apply(board, entry.after, entry.before);
  if (done.conflicts.length > 0) {
    // Refused: what was undone before stays to redo.
    return { history: { past: [], future: history.future }, patch: {}, conflicts: done.conflicts };
  }
  return {
    history: { past: history.past.slice(0, -1), future: [...history.future, entry] },
    patch: done.patch,
    conflicts: [],
  };
}

export function stepRedo(history: History, board: BoardState): Step | null {
  const entry = history.future.at(-1);
  if (!entry) {
    return null;
  }
  const done = apply(board, entry.before, entry.after);
  if (done.conflicts.length > 0) {
    // Refused: this step and every one redoable after it go.
    return { history: { past: history.past, future: [] }, patch: {}, conflicts: done.conflicts };
  }
  return {
    history: { past: [...history.past, entry], future: history.future.slice(0, -1) },
    patch: done.patch,
    conflicts: [],
  };
}
