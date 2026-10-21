import { createStore, type StoreApi } from "zustand";

import { EMPTY_HISTORY } from "../../domain/history";
import { readBoard } from "../../domain/persistence";
import type { BoardId, BoardState } from "../../domain/types";
import type { BoardStore } from "../../store/boardStore";
import { onLinkkitStored } from "./bridge";

/** What a board on the whiteboard shows while nobody edits it. */
export type DisplayStatus = "ok" | "missing" | "damaged" | "newer";

export interface DisplayBoard {
  readonly status: DisplayStatus;
  readonly store: StoreApi<BoardStore> | null;
}

const KEY_PREFIX = "boardkit:board:";

/**
 * A read-only board store for a board drawn on the whiteboard but not being
 * edited: the same shape as the app's store, so `ListColumn` and `CardItem`
 * draw it unchanged. Read straight from the saved record, never
 * written. A damaged record is shown as Boardkit would repair it; Boardkit
 * itself repairs it for real when the board is opened for editing.
 */
export function readDisplayBoard(boardId: BoardId, previous?: StoreApi<BoardStore> | null): DisplayBoard {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY_PREFIX + boardId);
  } catch {
    // Unreadable storage: shown as missing.
  }
  if (raw === null) return { status: "missing", store: null };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { status: "damaged", store: null };
  }
  const read = readBoard(data);
  if (read.status === "unreadable") return { status: "damaged", store: null };
  const status: DisplayStatus = read.status === "ok" ? "ok" : read.status === "newer" ? "newer" : "damaged";
  const board = read.board;
  if (!board) return { status, store: null };
  if (previous) {
    previous.setState(board as Partial<BoardStore>);
    return { status, store: previous };
  }
  return { status, store: createStore<BoardStore>(() => displayState(boardId, board)) };
}

/** Its actions are left out: nothing calls them on an inert board. */
function displayState(boardId: BoardId, board: BoardState): BoardStore {
  return {
    ...board,
    boardId,
    boards: [],
    history: EMPTY_HISTORY,
    cardDragOrigin: null,
  } as unknown as BoardStore;
}

/** Calls `listener` with the board id whenever another tab (or Boardkit on
    another page, or Linkkit on this one: a linked map) saves a board. */
export function onStoredElsewhere(listener: (boardId: BoardId) => void): () => void {
  const take = (key: string | null) => {
    if (key?.startsWith(KEY_PREFIX)) listener(key.slice(KEY_PREFIX.length) as BoardId);
  };
  const handle = (event: StorageEvent) => take(event.key);
  window.addEventListener("storage", handle);
  const stopLinkkit = onLinkkitStored(take);
  return () => {
    window.removeEventListener("storage", handle);
    stopLinkkit();
  };
}
