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
 * as it was before the step, theirs = the board now. For that each step
 * also keeps the whole board it started from -- references to its slices,
 * nothing copied. Rebuilding it from the step's own slices plus today's
 * others would mix two moments: a card erased elsewhere since would look
 * erased in the base too, and undoing a move of it would put back an id
 * pointing at nothing. Only the cards, lists
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
  /** The whole board just before the step (its slices, not copies). */
  readonly board: BoardState;
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
 * Records one step: `after` applied to `board`, the board's content just
 * before it. A step where every touched slice kept its previous reference --
 * a drag that resolved back to its own position, for example -- is not a
 * real change and is dropped rather than filling the stack with no-op undos.
 * Any genuine step clears `future`: redo only ever replays history that
 * undo just walked back through.
 */
export function pushEntry(history: History, board: BoardState, after: BoardPatch): History {
  const before: BoardPatch = {};
  for (const key of Object.keys(after) as (keyof BoardPatch)[]) {
    (before as Record<string, unknown>)[key] = board[key];
  }
  if (isNoOp(before, after)) {
    return history;
  }
  return { past: [...history.past, { before, after, board }].slice(-HISTORY_LIMIT), future: [] };
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

/** The patch taking `board` from `entry`'s one side to its other: the
    other side's slices themselves while `board` still holds this side's
    very slices, else the whole board merged item by item (see the file
    comment). */
function apply(
  board: BoardState,
  entry: HistoryEntry,
  action: "undo" | "redo",
): { patch: BoardPatch; conflicts: readonly MergeConflict[] } {
  const [from, to] = action === "undo" ? [entry.after, entry.before] : [entry.before, entry.after];
  const keys = Object.keys(from) as (keyof BoardPatch)[];
  if (keys.every((key) => board[key] === from[key])) return { patch: to, conflicts: [] };
  const merged = mergeBoards({ ...entry.board, ...from }, { ...entry.board, ...to }, board);
  // Unchanged objects kept, so only what the step puts back re-renders.
  return { patch: shareUnchanged(board, merged.board), conflicts: merged.conflicts };
}

/** `board` is the open board's content as it is now. */
export function stepUndo(history: History, board: BoardState): Step | null {
  const entry = history.past.at(-1);
  if (!entry) {
    return null;
  }
  const done = apply(board, entry, "undo");
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
  const done = apply(board, entry, "redo");
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
