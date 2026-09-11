import { create } from "zustand";

import { createBoardId, createCardId, createListId } from "../domain/ids";
import { EMPTY_HISTORY, pushEntry, stepRedo, stepUndo, type BoardPatch, type History } from "../domain/history";
import { moveBetweenLists, moveList, moveWithinList } from "../domain/ordering";
import { createEmptyBoard, createSeedBoard } from "../domain/seed";
import type { BoardId, BoardState, BoardSummary, CardId, IconKey, ListId, PaletteColor } from "../domain/types";
import {
  flushPersist,
  loadLegacyPersistedBoard,
  loadPersistedBoard,
  savePersistedBoardNow,
  schedulePersist,
} from "./persistBoard";
import { loadPersistedRegistry, savePersistedRegistryNow, schedulePersistRegistry } from "./persistRegistry";

/**
 * The board store.
 *
 * Zustand rather than React Context: Context re-renders *every* consumer
 * whenever its value changes, which on a board with hundreds of cards means a
 * single rename repaints everything. Zustand subscribes per selector, so a
 * component only re-renders when the slice it actually read changes.
 *
 * Every action below follows the same rule: copy only the slice that
 * changed, leave every other slice's reference untouched. Renaming a card
 * produces a new `cards` object but the same `lists`, `listOrder` and
 * `cardOrder` references, so selectors reading those bail out immediately.
 */
export interface BoardActions {
  addList: (title: string) => void;
  addCard: (listId: ListId, title: string) => void;
  renameList: (listId: ListId, title: string) => void;
  renameCard: (cardId: CardId, title: string) => void;
  deleteList: (listId: ListId) => void;
  deleteCard: (listId: ListId, cardId: CardId) => void;
  reorderCardsWithinList: (listId: ListId, activeId: CardId, overId: CardId) => void;
  moveCardBetweenLists: (
    activeId: CardId,
    fromListId: ListId,
    toListId: ListId,
    overId: CardId | null,
  ) => void;
  reorderLists: (activeId: ListId, overId: ListId) => void;
  setListColor: (listId: ListId, color: PaletteColor | undefined) => void;
  setListIcon: (listId: ListId, icon: IconKey | undefined) => void;
  setCardColor: (cardId: CardId, color: PaletteColor | undefined) => void;
  setCardDescription: (cardId: CardId, description: string | undefined) => void;
  setCardPostgameDescription: (cardId: CardId, description: string | undefined) => void;
  undo: () => void;
  redo: () => void;
  createBoard: (name: string) => void;
  switchBoard: (boardId: BoardId) => void;
  renameBoard: (name: string) => void;
}

/**
 * `boardId` and `boards` sit alongside `BoardState` rather than inside it:
 * they describe which board this is and what else exists, not the board's
 * own content, so they're excluded from `BoardPatch` (`Partial<BoardState>`)
 * the same way `history` already is -- `createBoard`/`switchBoard`/
 * `renameBoard` bypass `withHistory` entirely rather than becoming undoable
 * "edits".
 */
export type BoardStore = BoardState & {
  readonly history: History;
  readonly boardId: BoardId;
  readonly boards: readonly BoardSummary[];
} & BoardActions;

/**
 * Every mutating action produces a patch -- an object holding only the
 * slices it changed. This wraps that patch with its own undo record before
 * handing it to `set`: `before` is read straight off the current state for
 * each key the patch touches, which costs nothing extra since those are
 * already the same references the unchanged slices keep. See
 * `domain/history.ts` for why that makes a snapshot stack unnecessary.
 */
function withHistory(state: BoardStore, patch: BoardPatch): Partial<BoardStore> {
  const before: BoardPatch = {};
  for (const key of Object.keys(patch) as (keyof BoardPatch)[]) {
    (before as Record<string, unknown>)[key] = state[key];
  }
  return { ...patch, history: pushEntry(state.history, before, patch) };
}

/**
 * Where the very first `boardId`/`boards`/`board` come from. Three cases,
 * checked in order:
 *
 *  1. A registry already exists (the common case after the first run) --
 *     load whichever board it names as active.
 *  2. No registry, but content at the old single-board storage key -- a
 *     pre-multi-board install. That content becomes board one, and the
 *     registry plus its keyed copy are written immediately (not debounced;
 *     see `savePersistedRegistryNow`/`savePersistedBoardNow`) so the random
 *     id minted for it here is the same one found on the next load, rather
 *     than a fresh one every time the tab reopens before any edit is made.
 *  3. Neither -- a first-ever run, seeded with demo content the same way.
 */
function loadInitialState(): { boardId: BoardId; boards: readonly BoardSummary[]; board: BoardState } {
  const registry = loadPersistedRegistry();
  if (registry) {
    const board = loadPersistedBoard(registry.activeBoardId) ?? createEmptyBoard();
    return { boardId: registry.activeBoardId, boards: registry.boards, board };
  }

  const boardId = createBoardId();
  const legacyBoard = loadLegacyPersistedBoard();
  const board = legacyBoard ?? createSeedBoard();
  const boards: BoardSummary[] = [{ id: boardId, name: "Untitled board" }];

  savePersistedRegistryNow(boards, boardId);
  savePersistedBoardNow(board, boardId);

  return { boardId, boards, board };
}

const initial = loadInitialState();

export const useBoardStore = create<BoardStore>((set) => ({
  ...initial.board,
  boardId: initial.boardId,
  boards: initial.boards,
  history: EMPTY_HISTORY,

  addList: (title) =>
    set((state) => {
      const id = createListId();
      return withHistory(state, {
        lists: { ...state.lists, [id]: { id, title } },
        listOrder: [...state.listOrder, id],
        cardOrder: { ...state.cardOrder, [id]: [] },
      });
    }),

  addCard: (listId, title) =>
    set((state) => {
      const id = createCardId();
      return withHistory(state, {
        cards: { ...state.cards, [id]: { id, title } },
        cardOrder: {
          ...state.cardOrder,
          [listId]: [...state.cardOrder[listId], id],
        },
      });
    }),

  renameList: (listId, title) =>
    set((state) =>
      withHistory(state, {
        lists: { ...state.lists, [listId]: { ...state.lists[listId], title } },
      }),
    ),

  renameCard: (cardId, title) =>
    set((state) =>
      withHistory(state, {
        cards: { ...state.cards, [cardId]: { ...state.cards[cardId], title } },
      }),
    ),

  // A list carries no back-reference to its cards elsewhere, so deleting one
  // means cleaning up two places: its own entry and the cards that lived in
  // its `cardOrder` array.
  deleteList: (listId) =>
    set((state) => {
      const lists = { ...state.lists };
      const cards = { ...state.cards };
      const cardOrder = { ...state.cardOrder };
      const removedCardIds = cardOrder[listId];

      delete lists[listId];
      delete cardOrder[listId];
      for (const cardId of removedCardIds) {
        delete cards[cardId];
      }

      return withHistory(state, {
        lists,
        cards,
        cardOrder,
        listOrder: state.listOrder.filter((id) => id !== listId),
      });
    }),

  // `listId` is required here because a card does not store which list it
  // belongs to -- that membership lives only in `cardOrder`, so removing a
  // card means splicing it out of its list's array.
  deleteCard: (listId, cardId) =>
    set((state) => {
      const cards = { ...state.cards };
      delete cards[cardId];
      return withHistory(state, {
        cards,
        cardOrder: {
          ...state.cardOrder,
          [listId]: state.cardOrder[listId].filter((id) => id !== cardId),
        },
      });
    }),

  // A thin wrapper over the pure domain function: the store's only job is to
  // put the result back into the normalised shape.
  reorderCardsWithinList: (listId, activeId, overId) =>
    set((state) =>
      withHistory(state, {
        cardOrder: {
          ...state.cardOrder,
          [listId]: moveWithinList(state.cardOrder[listId], activeId, overId),
        },
      }),
    ),

  // Called continuously as a drag crosses into a different list, not just on
  // drop -- see DragContext's onDragOver. That is what makes the destination
  // list open a gap for the card while it is still being dragged, rather
  // than the card only appearing there once the pointer is released. Each
  // boundary crossing is its own undo step as a result -- a drag that visits
  // three lists before dropping produces three undo-able moves, not one --
  // which matches the fact that the board's content already changed at each
  // crossing, in full view, well before the drop.
  moveCardBetweenLists: (activeId, fromListId, toListId, overId) =>
    set((state) =>
      withHistory(state, {
        cardOrder: moveBetweenLists(state.cardOrder, activeId, fromListId, toListId, overId),
      }),
    ),

  reorderLists: (activeId, overId) =>
    set((state) =>
      withHistory(state, {
        listOrder: moveList(state.listOrder, activeId, overId),
      }),
    ),

  setListColor: (listId, color) =>
    set((state) =>
      withHistory(state, {
        lists: { ...state.lists, [listId]: { ...state.lists[listId], color } },
      }),
    ),

  setListIcon: (listId, icon) =>
    set((state) =>
      withHistory(state, {
        lists: { ...state.lists, [listId]: { ...state.lists[listId], icon } },
      }),
    ),

  setCardColor: (cardId, color) =>
    set((state) =>
      withHistory(state, {
        cards: { ...state.cards, [cardId]: { ...state.cards[cardId], color } },
      }),
    ),

  setCardDescription: (cardId, description) =>
    set((state) =>
      withHistory(state, {
        cards: { ...state.cards, [cardId]: { ...state.cards[cardId], description } },
      }),
    ),

  setCardPostgameDescription: (cardId, description) =>
    set((state) =>
      withHistory(state, {
        cards: {
          ...state.cards,
          [cardId]: { ...state.cards[cardId], postgameDescription: description },
        },
      }),
    ),

  // Undo and redo apply a recorded patch directly and move it between the
  // two stacks -- they never go through `withHistory`, or undoing would push
  // a fresh "undo the undo" entry and the redo stack could never be reached.
  undo: () =>
    set((state) => {
      const step = stepUndo(state.history);
      return step ? { ...step.patch, history: step.history } : state;
    }),

  redo: () =>
    set((state) => {
      const step = stepRedo(state.history);
      return step ? { ...step.patch, history: step.history } : state;
    }),

  // `flushPersist()` in both actions below: the debounce in `persistBoard.ts`
  // is a single shared timer, so switching away within its 400ms window
  // would otherwise cancel the outgoing board's pending save and silently
  // drop whatever was just typed, rather than writing it under its own key
  // before this board's content is replaced.
  createBoard: (name) =>
    set((state) => {
      flushPersist();
      const boardId = createBoardId();
      return {
        ...createEmptyBoard(),
        boardId,
        boards: [...state.boards, { id: boardId, name }],
        history: EMPTY_HISTORY,
      };
    }),

  switchBoard: (boardId) =>
    set((state) => {
      if (boardId === state.boardId) return state;
      flushPersist();
      const board = loadPersistedBoard(boardId) ?? createEmptyBoard();
      return { ...board, boardId, history: EMPTY_HISTORY };
    }),

  renameBoard: (name) =>
    set((state) => ({
      boards: state.boards.map((board) => (board.id === state.boardId ? { ...board, name } : board)),
    })),
}));

// The only subscribers that exist outside a component: persist whichever
// slice changed, debounced, to `localStorage`. `history` is deliberately
// excluded from both comparisons and both writes -- undo stacks are a
// live-session convenience, not saved content, so a reload starts with a
// clean one.
useBoardStore.subscribe((state, previous) => {
  if (
    state.lists !== previous.lists ||
    state.cards !== previous.cards ||
    state.listOrder !== previous.listOrder ||
    state.cardOrder !== previous.cardOrder
  ) {
    schedulePersist(state, state.boardId);
  }
  if (state.boards !== previous.boards || state.boardId !== previous.boardId) {
    schedulePersistRegistry(state.boards, state.boardId);
  }
});
