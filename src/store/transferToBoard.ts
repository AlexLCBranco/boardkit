import { isListFull } from "../domain/limits";
import { insertCardCopy, insertListCopy } from "../domain/transfer";
import type { BoardId, BoardState, Card, CardId, List, ListId } from "../domain/types";
import { flushPersist, loadPersistedBoard, savePersistedBoardNow } from "./persistBoard";

/**
 * Putting things into a board that is not the one on screen.
 *
 * Only the active board lives in the store; every other board is a JSON
 * document in `localStorage`. So a transfer is: flush, load the target, apply
 * a pure function from `domain/transfer.ts`, write it straight back. The store
 * actions in `boardStore.ts` call these and, for a *move*, then trash the
 * original through the normal (undoable) delete actions.
 */

export type TransferResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

/** A list on another board, as the picker needs it. */
export interface TransferTarget {
  readonly id: ListId;
  readonly title: string;
  readonly full: boolean;
}

const LOAD_FAILED =
  "That board could not be read, so nothing was changed. Its saved data is left as it is.";

/**
 * Flushes first, then loads. The save debounce is one shared timer: a board
 * left less than 400ms ago may still have edits pending, and reading before
 * they land would make the write below clobber them.
 *
 * `null` means missing *or* corrupt -- callers must stop, never write a fresh
 * board over it.
 */
function loadTarget(boardId: BoardId): BoardState | null {
  flushPersist();
  return loadPersistedBoard(boardId);
}

/** The lists on `boardId`, left to right, for the "pick a list" submenu.
    `null` if the board cannot be loaded. Read on demand, not kept in state. */
export function loadTransferTargets(boardId: BoardId): readonly TransferTarget[] | null {
  const board = loadTarget(boardId);
  if (!board) return null;
  return board.listOrder.map((id) => ({
    id,
    title: board.lists[id].title,
    full: isListFull(board.cardOrder[id] ?? []),
  }));
}

export function copyCardToBoard(
  card: Card,
  targetBoardId: BoardId,
  targetListId: ListId,
): TransferResult {
  const target = loadTarget(targetBoardId);
  if (!target) return { ok: false, message: LOAD_FAILED };

  const next = insertCardCopy(target, card, targetListId);
  if (!next) return { ok: false, message: "That list is full or no longer exists." };

  savePersistedBoardNow(next, targetBoardId);
  return { ok: true };
}

export function copyListToBoard(
  list: List,
  cards: readonly Card[],
  targetBoardId: BoardId,
): TransferResult {
  const target = loadTarget(targetBoardId);
  if (!target) return { ok: false, message: LOAD_FAILED };

  savePersistedBoardNow(insertListCopy(target, list, cards), targetBoardId);
  return { ok: true };
}

/** A list's cards, in order, read from the active board's state. */
export function cardsOfList(state: BoardState, listId: ListId): Card[] {
  return state.cardOrder[listId].map((id: CardId) => state.cards[id]);
}
