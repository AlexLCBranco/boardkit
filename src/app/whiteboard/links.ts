import { useCallback, useSyncExternalStore } from "react";

import { readBoard } from "../../domain/persistence";
import type { BoardId, BoardState, CardId, ListId } from "../../domain/types";
import { setUrlOf, urlOf } from "../../features/board/links";
import { useBoardStore } from "../../store/boardStore";
import type { LinkTarget } from "../../store/linkPromptStore";
import { flushPersist, persistedBoardText } from "../../store/persistBoard";
import { onStoredElsewhere } from "./displayStore";
import { onStoredHere, openWhiteboardBoard } from "./history";

/**
 * Links on a board shown on the gauntlet whiteboard (owner, 2026-10-23), for
 * the whiteboard's own right-click menu, Ctrl+K and link icon, where the
 * board isn't being edited. Inside a board being edited, Boardkit's own menu
 * and Ctrl+K do it (features/board/links.tsx).
 */

/** What can hold a link on a board, by plain ids (the whiteboard's side). */
export type WhiteboardLinkTarget =
  | { readonly kind: "card"; readonly cardId: string }
  | { readonly kind: "list"; readonly listId: string }
  | { readonly kind: "board" };

const asTarget = (t: WhiteboardLinkTarget): LinkTarget =>
  t.kind === "card" ? { kind: "card", cardId: t.cardId as CardId } : t.kind === "list" ? { kind: "list", listId: t.listId as ListId } : t;

/** The board as it is now: Boardkit's store when it holds it, else saved. */
function currentBoard(boardId: BoardId): BoardState | null {
  const state = useBoardStore.getState();
  if (state.boardId === boardId) return state;
  return storedBoard(boardId);
}

/** Each board's last read, by its saved text: read again only once changed. */
const cache = new Map<BoardId, { readonly text: string | null; readonly board: BoardState | null }>();
function storedBoard(boardId: BoardId): BoardState | null {
  const text = persistedBoardText(boardId);
  const cached = cache.get(boardId);
  if (cached && cached.text === text) return cached.board;
  let board: BoardState | null = null;
  try {
    const read = text === null ? null : readBoard(JSON.parse(text));
    board = read && read.status !== "unreadable" ? read.board : null;
  } catch {
    board = null;
  }
  cache.set(boardId, { text, board });
  return board;
}

/** The link `target` on board `boardId` holds, if any. */
export function whiteboardItemUrl(boardId: string, target: WhiteboardLinkTarget): string | undefined {
  const board = currentBoard(boardId as BoardId);
  return board ? urlOf(board, asTarget(target)) : undefined;
}

/** Sets (`undefined`: removes) `target`'s link on board `boardId`, through
    Boardkit's store: one undo step there, which the whiteboard's page undo
    hears (history.ts), saved at once. The whiteboard ends any board's
    editing first: this opens `boardId` in the store. */
export function setWhiteboardItemUrl(boardId: string, target: WhiteboardLinkTarget, url: string | undefined): void {
  const id = boardId as BoardId;
  openWhiteboardBoard(id);
  setUrlOf(useBoardStore.getState(), asTarget(target), url);
  flushPersist();
}

/** The board's own link, kept current (its icon on the whiteboard). */
export function useWhiteboardBoardUrl(boardId: string): string | undefined {
  const id = boardId as BoardId;
  const subscribe = useCallback(
    (changed: () => void) => {
      const stopElsewhere = onStoredElsewhere((stored) => stored === id && changed());
      const stopHere = onStoredHere((stored) => stored === id && changed());
      const stopStore = useBoardStore.subscribe((state, prev) => {
        if (state.boardId === id && (state.url !== prev.url || prev.boardId !== id)) changed();
      });
      return () => {
        stopElsewhere();
        stopHere();
        stopStore();
      };
    },
    [id],
  );
  return useSyncExternalStore(subscribe, () => currentBoard(id)?.url);
}
