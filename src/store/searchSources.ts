import type { SearchSource } from "../domain/search";
import { useBoardStore } from "./boardStore";
import { flushPersist, loadPersistedBoard } from "./persistBoard";

/**
 * The boards search looks through. Only the active board lives in the store;
 * every other one is a JSON document in `localStorage`, so this is the one
 * place that knows how to gather all of them. It only ever reads: search never
 * writes a board, so a board that fails to load is simply left out rather than
 * treated as an error -- and can never be overwritten by anything here.
 *
 * Meant to be called once when the search dialog opens, not per keystroke.
 */
export function loadSearchSources(): readonly SearchSource[] {
  // The save debounce is one shared timer: a board left (or edited) less than
  // 400ms ago may still have changes pending, and reading storage before they
  // land would search stale text.
  flushPersist();

  const { boardId: activeId, boards, cards, lists, listOrder, cardOrder, trash, trashedLists } =
    useBoardStore.getState();
  const sources: SearchSource[] = [];

  // The active board comes from memory, not storage, and goes first.
  const active = boards.find((board) => board.id === activeId);
  if (active) {
    sources.push({
      boardId: activeId,
      boardName: active.name,
      board: { cards, lists, listOrder, cardOrder, trash, trashedLists },
    });
  }

  // Stored oldest-first; searched newest-first, matching the board switcher.
  for (const summary of [...boards].reverse()) {
    if (summary.id === activeId) continue;
    const board = loadPersistedBoard(summary.id);
    if (board) sources.push({ boardId: summary.id, boardName: summary.name, board });
  }
  return sources;
}
