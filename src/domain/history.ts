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

export function stepUndo(history: History): { history: History; patch: BoardPatch } | null {
  const entry = history.past.at(-1);
  if (!entry) {
    return null;
  }
  return {
    history: { past: history.past.slice(0, -1), future: [...history.future, entry] },
    patch: entry.before,
  };
}

export function stepRedo(history: History): { history: History; patch: BoardPatch } | null {
  const entry = history.future.at(-1);
  if (!entry) {
    return null;
  }
  return {
    history: { past: [...history.past, entry], future: history.future.slice(0, -1) },
    patch: entry.after,
  };
}
