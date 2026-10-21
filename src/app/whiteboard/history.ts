import { EMPTY_HISTORY, type History } from "../../domain/history";
import type { BoardId } from "../../domain/types";
import { openEmbeddedBoard, useBoardStore } from "../../store/boardStore";
import { flushPersist, onBoardStored } from "../../store/persistBoard";

/**
 * Undo and redo of board edits for the gauntlet whiteboard, which keeps one
 * undo for the whole page (its own order of which history acted: its
 * drawing's or a board's). Boardkit's history stays Boardkit's; this only
 * lets the whiteboard (1) hear of each new undoable board step, and
 * (2) undo or redo a given board's latest step, open or not.
 *
 * Only the board being edited lives in Boardkit's store, and opening another
 * one starts it with no history. Here each board's history is kept while
 * another is open, and given back when it is opened again (histories
 * survive changes from elsewhere: domain/history.ts).
 */

const kept = new Map<BoardId, History>();
/** Set while this module itself undoes or redoes, so that is not a new step. */
let stepping = false;

type StepListener = (event: { readonly boardId: BoardId; readonly kind: "step" | "undo" | "redo" }) => void;
const listeners = new Set<StepListener>();

/** Tells `listener` of every board history change not made through
    `undoBoard`/`redoBoard`: a new step ("step"), or Boardkit undoing or
    redoing by itself (an "Undo" in a toast, say). Returns a stop function. */
export function onBoardHistory(listener: StepListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

useBoardStore.subscribe((state, prev) => {
  if (stepping || state.history === prev.history || state.boardId !== prev.boardId) return;
  const now = state.history;
  const before = prev.history;
  let kind: "step" | "undo" | "redo" | null = null;
  if (now.past.length === before.past.length - 1 && now.future.length === before.future.length + 1) kind = "undo";
  else if (now.past.length === before.past.length + 1 && now.future.length === before.future.length - 1 && now.future.length > 0)
    kind = "redo";
  else if (now.past.length > 0 && now.past.at(-1) !== before.past.at(-1) && now.future.length === 0) kind = "step";
  if (!kind) return;
  for (const listener of listeners) listener({ boardId: state.boardId, kind });
});

/**
 * Opens `boardId` in the store for the whiteboard, keeping the history of
 * the board open before it, and giving this one back its own.
 */
export function openWhiteboardBoard(boardId: BoardId): void {
  const state = useBoardStore.getState();
  if (state.boardId === boardId) return openEmbeddedBoard(boardId);
  if (state.history !== EMPTY_HISTORY) kept.set(state.boardId, state.history);
  openEmbeddedBoard(boardId);
  const history = kept.get(boardId);
  if (history) {
    kept.delete(boardId);
    useBoardStore.setState({ history });
  }
}

function step(boardId: BoardId, kind: "undo" | "redo"): boolean {
  openWhiteboardBoard(boardId);
  const store = useBoardStore.getState();
  const before = store.history;
  if ((kind === "undo" ? before.past : before.future).length === 0) return false;
  stepping = true;
  try {
    store[kind]();
  } finally {
    stepping = false;
  }
  // Stored at once, so the board shows it (and other tabs get it) now.
  flushPersist();
  return useBoardStore.getState().history !== before;
}

/** Undoes `boardId`'s latest step; false when it had none (or Boardkit
    refused it: changed elsewhere since, see domain/history.ts). */
export const undoBoard = (boardId: string) => step(boardId as BoardId, "undo");
/** Redoes `boardId`'s latest undone step; false when there is none. */
export const redoBoard = (boardId: string) => step(boardId as BoardId, "redo");

/** Calls `listener` when this page stores a board (an undo of a board not
    being edited included), for whatever shows it to read it again. */
const storedHere = new Set<(boardId: BoardId) => void>();
onBoardStored((boardId) => {
  for (const listener of storedHere) listener(boardId);
});
export function onStoredHere(listener: (boardId: BoardId) => void): () => void {
  storedHere.add(listener);
  return () => storedHere.delete(listener);
}
