import { create } from "zustand";

import { imageIdOf } from "../domain/background";
import { pasteCardsIntoList } from "../domain/clipboard";
import { duplicateList as duplicateListState, layoutOnly } from "../domain/duplicate";
import { createBoardId, createCardId, createListId } from "../domain/ids";
import { EMPTY_HISTORY, pushEntry, stepRedo, stepUndo, type BoardPatch, type History } from "../domain/history";
import { isListFull } from "../domain/limits";
import { insertAt, moveBetweenLists, moveList, moveWithinList } from "../domain/ordering";
import type { BackupBoard } from "../domain/persistence";
import { createEmptyBoard, createSeedBoard } from "../domain/seed";
import {
  emptyListTrash as emptyListTrashState,
  emptyTrash as emptyTrashState,
  moveCardToTrash,
  moveListToTrash,
  permanentlyDeleteCard as permanentlyDeleteCardState,
  permanentlyDeleteList as permanentlyDeleteListState,
  restoreCardFromTrash,
  restoreListFromTrash,
} from "../domain/trash";
import type {
  BoardBackground,
  BoardId,
  BoardState,
  BoardSummary,
  Card,
  CardId,
  CardKind,
  IconKey,
  ListId,
  ListWidth,
  ItemColor,
  NumberEmphasis,
  NumberFormat,
} from "../domain/types";
import { releaseImageIfUnused } from "./imageStore";
import {
  flushPersist,
  loadLegacyPersistedBoard,
  loadPersistedBoard,
  removePersistedBoard,
  savePersistedBoardNow,
  schedulePersist,
} from "./persistBoard";
import {
  flushPersistRegistry,
  loadPersistedRegistry,
  savePersistedRegistryNow,
  schedulePersistRegistry,
} from "./persistRegistry";
import {
  cardsOfList,
  copyCardToBoard,
  copyListToBoard,
  type TransferResult,
} from "./transferToBoard";

export type TransferMode = "move" | "copy";

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
  /** Inserts a card at `index` in a list (0 = top) and returns its id, or
      `null` when the list is full. */
  addCardAt: (listId: ListId, index: number, title: string) => CardId | null;
  renameList: (listId: ListId, title: string) => void;
  renameCard: (cardId: CardId, title: string) => void;
  deleteList: (listId: ListId) => void;
  duplicateList: (listId: ListId) => void;
  deleteCard: (listId: ListId, cardId: CardId) => void;
  /** Pastes copies of `cards` at the bottom of a list, as far as the card
      limit allows. One undo step. */
  pasteCards: (listId: ListId, cards: readonly Card[]) => void;
  restoreCard: (cardId: CardId) => void;
  permanentlyDeleteCard: (cardId: CardId) => void;
  emptyTrash: () => void;
  restoreList: (listId: ListId) => void;
  permanentlyDeleteList: (listId: ListId) => void;
  emptyListTrash: () => void;
  reorderCardsWithinList: (listId: ListId, activeId: CardId, overId: CardId) => void;
  moveCardBetweenLists: (
    activeId: CardId,
    fromListId: ListId,
    toListId: ListId,
    overId: CardId | null,
  ) => void;
  reorderLists: (activeId: ListId, overId: ListId) => void;
  setListColor: (listId: ListId, color: ItemColor | undefined) => void;
  setListIcon: (listId: ListId, icon: IconKey | undefined) => void;
  /** One undo step. */
  setListContinuesNumbering: (listId: ListId, continues: boolean) => void;
  /** `undefined` goes back to plain digits. One undo step. */
  setListNumberFormat: (listId: ListId, format: NumberFormat | undefined) => void;
  setListWidths: (updates: Readonly<Record<ListId, ListWidth | undefined>>) => void;
  /** `undefined` goes back to the theme's own background. One undo step. */
  setBackground: (background: BoardBackground | undefined) => void;
  /** `undefined` makes it a normal card again. One undo step. */
  setCardKind: (cardId: CardId, kind: CardKind | undefined) => void;
  setCardColor: (cardId: CardId, color: ItemColor | undefined) => void;
  /** Sets the emphasis on every card given -- one card from its customise
      panel, or a whole marquee selection -- in one undo step. `undefined`
      goes back to normal. */
  setCardsNumberEmphasis: (cardIds: readonly CardId[], emphasis: NumberEmphasis | undefined) => void;
  setCardDescription: (cardId: CardId, description: string | undefined) => void;
  setCardPostgameDescription: (cardId: CardId, description: string | undefined) => void;
  undo: () => void;
  redo: () => void;
  createBoard: (name: string) => void;
  duplicateBoard: (name: string) => void;
  createBoardFromLayout: (name: string) => void;
  /** Copies a card to the bottom of a list on another board. A move then
      trashes the original here (an ordinary, undoable delete). */
  sendCardToBoard: (
    mode: TransferMode,
    listId: ListId,
    cardId: CardId,
    targetBoardId: BoardId,
    targetListId: ListId,
  ) => TransferResult;
  /** Same, for a whole list, which lands at the right-hand end of the board. */
  sendListToBoard: (mode: TransferMode, listId: ListId, targetBoardId: BoardId) => TransferResult;
  addBoards: (entries: readonly BackupBoard[]) => void;
  deleteBoard: () => void;
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

export const useBoardStore = create<BoardStore>((set, get) => ({
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

  // A full list (see domain/limits.ts) ignores the request. The UI hides
  // the composer before this can happen; the guard here is what makes the
  // limit true for every caller, not just the ones that remember the UI.
  addCard: (listId, title) =>
    set((state) => {
      if (isListFull(state.cardOrder[listId])) {
        return state;
      }
      const id = createCardId();
      return withHistory(state, {
        cards: { ...state.cards, [id]: { id, title } },
        cardOrder: {
          ...state.cardOrder,
          [listId]: [...state.cardOrder[listId], id],
        },
      });
    }),

  // Same limit guard as `addCard`, but the caller needs to know whether a
  // card was made (and which one) to focus it, so this returns the id
  // instead of leaving the outcome to be inferred from the state.
  addCardAt: (listId, index, title) => {
    if (isListFull(get().cardOrder[listId])) {
      return null;
    }
    const id = createCardId();
    set((state) =>
      withHistory(state, {
        cards: { ...state.cards, [id]: { id, title } },
        cardOrder: { ...state.cardOrder, [listId]: insertAt(state.cardOrder[listId], id, index) },
      }),
    );
    return id;
  },

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

  // Unlike a trashed card, a trashed list keeps everything -- its own
  // record, its `cardOrder` entry, every card in it -- untouched. Only
  // `listOrder` loses the id, so restoring is a plain re-insertion with no
  // separate bookkeeping for the cards that were in it.
  deleteList: (listId) =>
    set((state) => withHistory(state, moveListToTrash(state, listId, Date.now()))),

  duplicateList: (listId) =>
    set((state) =>
      withHistory(state, duplicateListState(state, listId, `${state.lists[listId].title} (copy)`)),
    ),

  restoreList: (listId) =>
    set((state) => {
      const patch = restoreListFromTrash(state, listId);
      return patch ? withHistory(state, patch) : state;
    }),

  permanentlyDeleteList: (listId) =>
    set((state) => withHistory(state, permanentlyDeleteListState(state, listId))),

  emptyListTrash: () => set((state) => withHistory(state, emptyListTrashState(state))),

  // `listId` is required here because a card does not store which list it
  // belongs to -- that membership lives only in `cardOrder`, so removing a
  // card means splicing it out of its list's array. The card is not erased:
  // it moves into `trash`, restorable from there until it ages out or is
  // deleted forever.
  deleteCard: (listId, cardId) =>
    set((state) => withHistory(state, moveCardToTrash(state, listId, cardId, Date.now()))),

  pasteCards: (listId, cards) =>
    set((state) => {
      const patch = pasteCardsIntoList(state, listId, cards);
      return patch ? withHistory(state, patch) : state;
    }),

  restoreCard: (cardId) =>
    set((state) => {
      const patch = restoreCardFromTrash(state, cardId);
      return patch ? withHistory(state, patch) : state;
    }),

  permanentlyDeleteCard: (cardId) =>
    set((state) => withHistory(state, permanentlyDeleteCardState(state, cardId))),

  emptyTrash: () => set((state) => withHistory(state, emptyTrashState(state))),

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
  //
  // A full destination list refuses the card: it opens no gap, and the card
  // stays in the list it came from.
  moveCardBetweenLists: (activeId, fromListId, toListId, overId) =>
    set((state) => {
      if (isListFull(state.cardOrder[toListId])) {
        return state;
      }
      return withHistory(state, {
        cardOrder: moveBetweenLists(state.cardOrder, activeId, fromListId, toListId, overId),
      });
    }),

  reorderLists: (activeId, overId) =>
    set((state) =>
      withHistory(state, {
        listOrder: moveList(state.listOrder, activeId, overId),
      }),
    ),

  // Setting a colour on the list clears any colour its cards picked
  // individually, so the button reads as "override" rather than "the ones
  // that haven't been touched yet": pressing it after customising a card
  // still wins. Clearing the list back to no colour leaves card colours
  // alone -- that action isn't asking those cards to give anything up.
  setListColor: (listId, color) =>
    set((state) => {
      if (color === undefined) {
        return withHistory(state, {
          lists: { ...state.lists, [listId]: { ...state.lists[listId], color } },
        });
      }
      const cards = { ...state.cards };
      for (const cardId of state.cardOrder[listId]) {
        cards[cardId] = { ...cards[cardId], color: undefined };
      }
      return withHistory(state, {
        lists: { ...state.lists, [listId]: { ...state.lists[listId], color } },
        cards,
      });
    }),

  setListIcon: (listId, icon) =>
    set((state) =>
      withHistory(state, {
        lists: { ...state.lists, [listId]: { ...state.lists[listId], icon } },
      }),
    ),

  // `false` is stored as absent, so lists that never touched this keep the
  // same shape as boards saved before it existed.
  setListContinuesNumbering: (listId, continues) =>
    set((state) =>
      withHistory(state, {
        lists: {
          ...state.lists,
          [listId]: { ...state.lists[listId], continuesNumbering: continues || undefined },
        },
      }),
    ),

  setListNumberFormat: (listId, format) =>
    set((state) =>
      withHistory(state, {
        lists: { ...state.lists, [listId]: { ...state.lists[listId], numberFormat: format } },
      }),
    ),

  // A single resize/auto-fit is `updates` with one entry; the Alt-modified
  // "every list at once" form has one per column (ListColumn.tsx). Either
  // way, every affected list lands in one `lists` patch, so the gesture is
  // one undo step regardless of how many columns it touched.
  setListWidths: (updates) =>
    set((state) => {
      const lists = { ...state.lists };
      for (const listId of Object.keys(updates) as ListId[]) {
        lists[listId] = { ...lists[listId], width: updates[listId] };
      }
      return withHistory(state, { lists });
    }),

  setBackground: (background) => set((state) => withHistory(state, { background })),

  setCardKind: (cardId, kind) =>
    set((state) =>
      withHistory(state, {
        cards: { ...state.cards, [cardId]: { ...state.cards[cardId], kind } },
      }),
    ),

  setCardColor: (cardId, color) =>
    set((state) =>
      withHistory(state, {
        cards: { ...state.cards, [cardId]: { ...state.cards[cardId], color } },
      }),
    ),

  // Ids no longer on the board (a selection that outlived a delete) are
  // skipped rather than recreated as half-empty cards.
  setCardsNumberEmphasis: (cardIds, emphasis) =>
    set((state) => {
      const cards = { ...state.cards };
      for (const cardId of cardIds) {
        if (cards[cardId]) {
          cards[cardId] = { ...cards[cardId], numberEmphasis: emphasis };
        }
      }
      return withHistory(state, { cards });
    }),

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
  //
  // A new board is also written to storage immediately, both its content and
  // its registry entry, rather than left to the debounced subscriber below: a
  // board the user explicitly created must survive a reload, a crash or a
  // closed tab even if that happens inside the 400ms window.
  createBoard: (name) =>
    set((state) => {
      flushPersist();
      const boardId = createBoardId();
      const board = createEmptyBoard();
      const boards = [...state.boards, { id: boardId, name }];
      savePersistedBoardNow(board, boardId);
      savePersistedRegistryNow(boards, boardId);
      return { ...board, boardId, boards, history: EMPTY_HISTORY };
    }),

  // Starts next week's board from this week's: same lists, cards and
  // customisation, under a new id, and becomes the active board. Ids are only
  // ever looked up within one board, so the copy can keep them as-is -- and
  // because the state is immutable, sharing the same `lists`/`cards`
  // references with the original is safe: the first edit to either board
  // copies the slice it touches. The background is carried over: a copy of a
  // board should look like it. Trash is not carried over; a fresh week
  // should not inherit last week's deleted cards.
  //
  // Written to storage immediately rather than left to the subscriber below:
  // that only fires when a content slice's reference changes, and a straight
  // copy changes none of the ones it compares except `trash`.
  duplicateBoard: (name) =>
    set((state) => {
      flushPersist();
      const boardId = createBoardId();
      const board: BoardState = {
        lists: state.lists,
        cards: state.cards,
        listOrder: state.listOrder,
        cardOrder: state.cardOrder,
        trash: [],
        trashedLists: [],
        background: state.background,
      };
      const boards = [...state.boards, { id: boardId, name }];
      savePersistedBoardNow(board, boardId);
      savePersistedRegistryNow(boards, boardId);
      return { ...board, boardId, boards, history: EMPTY_HISTORY };
    }),

  // A new board with this board's lists but none of its cards. Storage
  // bookkeeping matches `duplicateBoard`, including the flush: the source
  // board may still have an edit waiting in the 400ms save window.
  createBoardFromLayout: (name) =>
    set((state) => {
      flushPersist();
      const boardId = createBoardId();
      const board = layoutOnly(state);
      const boards = [...state.boards, { id: boardId, name }];
      savePersistedBoardNow(board, boardId);
      savePersistedRegistryNow(boards, boardId);
      return { ...board, boardId, boards, history: EMPTY_HISTORY };
    }),

  // Cross-board transfers write to another board's storage document, which
  // is not in memory (see `transferToBoard.ts`). A *move* is copy-then-trash:
  // the original goes through the normal undoable delete, so Ctrl+Z only ever
  // affects this board -- undoing a move restores the original here and
  // leaves the copy on the other board, rather than needing an undo system
  // that spans boards. The original is trashed only if the copy succeeded.
  sendCardToBoard: (mode, listId, cardId, targetBoardId, targetListId) => {
    const result = copyCardToBoard(get().cards[cardId], targetBoardId, targetListId);
    if (result.ok && mode === "move") get().deleteCard(listId, cardId);
    return result;
  },

  sendListToBoard: (mode, listId, targetBoardId) => {
    const state = get();
    const result = copyListToBoard(
      state.lists[listId],
      cardsOfList(state, listId),
      targetBoardId,
    );
    if (result.ok && mode === "move") get().deleteList(listId);
    return result;
  },

  // Adds boards to the registry without switching to any of them, so an
  // import never disturbs what is on screen. Each board's content is written
  // straight to storage -- it is not the active board, so the subscriber
  // below (which only watches the active board's slices) would never save it.
  // Callers pass only boards that are new; see `features/board/backup.ts`.
  addBoards: (entries) =>
    set((state) => {
      if (entries.length === 0) return state;
      for (const entry of entries) {
        savePersistedBoardNow(entry.board, entry.id);
      }
      return {
        boards: [...state.boards, ...entries.map(({ id, name }) => ({ id, name }))],
      };
    }),

  // Deletes the active board for good -- there is no board-level trash, so
  // the UI confirms first. The last remaining board cannot be deleted: the
  // app always has one to show. Afterwards the newest remaining board becomes
  // active, matching the newest-first order the switcher lists them in.
  deleteBoard: () =>
    set((state) => {
      if (state.boards.length <= 1) return state;
      flushPersist();
      removePersistedBoard(state.boardId);
      const boards = state.boards.filter((board) => board.id !== state.boardId);
      // Its background image goes too, unless a duplicate of this board still
      // shows it. (Not undoable, unlike replacing an image, so no need to wait.)
      const orphanedImage = imageIdOf(state.background);
      if (orphanedImage !== undefined) void releaseImageIfUnused(orphanedImage, boards);
      const nextId = boards[boards.length - 1].id;
      const board = loadPersistedBoard(nextId) ?? createEmptyBoard();
      return { ...board, boardId: nextId, boards, history: EMPTY_HISTORY };
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
    state.cardOrder !== previous.cardOrder ||
    state.trash !== previous.trash ||
    state.trashedLists !== previous.trashedLists ||
    state.background !== previous.background
  ) {
    schedulePersist(state, state.boardId);
  }
  if (state.boards !== previous.boards || state.boardId !== previous.boardId) {
    schedulePersistRegistry(state.boards, state.boardId);
  }
});

// A 400ms debounce means a reload (or a dev-server HMR reload, which tears
// down and re-runs this module) that lands inside that window would
// otherwise cancel the pending timer and drop whatever was just typed.
// `visibilitychange` catches a tab switch or reload on every browser;
// `pagehide` catches the final unload -- mobile Safari never fires
// `beforeunload`, so that one is deliberately not used here.
function flushAllPersistence(): void {
  flushPersist();
  flushPersistRegistry();
}
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushAllPersistence();
  });
  window.addEventListener("pagehide", flushAllPersistence);
}
