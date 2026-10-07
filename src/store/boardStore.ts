import { create, type StateCreator } from "zustand";

import { imageIdOf } from "../domain/background";
import { pasteCardsIntoList } from "../domain/clipboard";
import { duplicateList as duplicateListState, layoutOnly } from "../domain/duplicate";
import { settleCardDrag } from "../domain/cardDrag";
import { listOfCard, withCollapsed } from "../domain/collapse";
import { createBoardId, createCardId, createListId } from "../domain/ids";
import { EMPTY_HISTORY, pushEntry, stepRedo, stepUndo, type BoardPatch, type History } from "../domain/history";
import { isListFull } from "../domain/limits";
import { mergeBoardLists, mergeBoards, sameValue, shareUnchanged } from "../domain/merge";
import { insertAt, moveBetweenLists, moveList, moveWithinList } from "../domain/ordering";
import { boardContent, type BackupBoard } from "../domain/persistence";
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
  HighlightStyle,
  IconKey,
  ListId,
  ListWidth,
  ItemColor,
  NumberEmphasis,
  NumberFormat,
} from "../domain/types";
import { releaseImageIfUnused } from "./imageStore";
import { findLinkedMap } from "./linkedMap";
import {
  allowBoardWrites,
  boardIdOfKey,
  catchUpBoard,
  flushPersist,
  forgetBoardDeletedElsewhere,
  loadLegacyPersistedBoard,
  onBoardMerged,
  openPersistedBoard,
  removeOrphanedSetAside,
  removePersistedBoard,
  savePersistedBoardNow,
  schedulePersist,
} from "./persistBoard";
import {
  catchUpBoardList,
  flushPersistRegistry,
  isBoardListKey,
  loadPersistedRegistry,
  onBoardListMerged,
  savePersistedRegistryNow,
  schedulePersistRegistry,
  type BoardListCatchUp,
} from "./persistRegistry";
import { isReadOnlyBoard, useRecoveryStore } from "./recoveryStore";
import { rememberStarterBoard } from "./starterBoard";
import { useSyncNotice } from "./syncNoticeStore";
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
  /** Starts a card drag: remembers `cardOrder` so the drag can settle into
      one undo step, or be rolled back. */
  beginCardDrag: () => void;
  /** Mid-drag preview move into another list. Not recorded in history. */
  moveCardBetweenLists: (
    activeId: CardId,
    fromListId: ListId,
    toListId: ListId,
    overId: CardId | null,
  ) => void;
  /** Drops the dragged card, optionally moving it onto `overId` within its
      list first, and records the whole drag as one undo step (none if it
      ended where it began). */
  endCardDrag: (
    reorder: { readonly listId: ListId; readonly activeId: CardId; readonly overId: CardId } | null,
  ) => void;
  /** Esc, or a drop outside every list: puts every card back. */
  cancelCardDrag: () => void;
  /** Drops the dragged card at the bottom of `toListId` -- a collapsed list,
      which shows no cards to drop between. Settles like `endCardDrag`; a
      full list refuses the card and the drag is rolled back instead. */
  endCardDragInto: (activeId: CardId, fromListId: ListId, toListId: ListId) => void;
  reorderLists: (activeId: ListId, overId: ListId) => void;
  setListColor: (listId: ListId, color: ItemColor | undefined) => void;
  setListIcon: (listId: ListId, icon: IconKey | undefined) => void;
  /** One undo step. */
  setListContinuesNumbering: (listId: ListId, continues: boolean) => void;
  /** `undefined` goes back to plain digits. Picking a format also shows
      hidden numbers again, in the same undo step. */
  setListNumberFormat: (listId: ListId, format: NumberFormat | undefined) => void;
  /** Display only -- numbering still counts the list's cards. One undo step. */
  setListNumbersHidden: (listId: ListId, hidden: boolean) => void;
  setListWidths: (updates: Readonly<Record<ListId, ListWidth | undefined>>) => void;
  /** Folds a list to a strip or opens it again. A view setting: saved with
      the board, never an undo step (see domain/collapse.ts). */
  setListCollapsed: (listId: ListId, collapsed: boolean) => void;
  /** Opens whichever list holds the card, so it can be shown. */
  expandListOf: (cardId: CardId) => void;
  /** `undefined` goes back to the theme's own background. One undo step. */
  setBackground: (background: BoardBackground | undefined) => void;
  /** `undefined` makes it a normal card again. One undo step. */
  setCardKind: (cardId: CardId, kind: CardKind | undefined) => void;
  setCardColor: (cardId: CardId, color: ItemColor | undefined) => void;
  /** Sets the emphasis on every card given -- one card from its customise
      panel, or a whole marquee selection -- in one undo step. `undefined`
      goes back to normal. */
  setCardsNumberEmphasis: (cardIds: readonly CardId[], emphasis: NumberEmphasis | undefined) => void;
  /** Highlight colour for every card given, in one undo step, like
      `setCardsNumberEmphasis`. `undefined` removes the highlight. */
  setCardsHighlight: (cardIds: readonly CardId[], highlight: ItemColor | undefined) => void;
  /** How the given cards' highlights are drawn. `undefined` goes back to a ring. */
  setCardsHighlightStyle: (cardIds: readonly CardId[], style: HighlightStyle | undefined) => void;
  /** Clears number emphasis, highlight and highlight style on every card
      given -- everything the selection bar can set -- in one undo step. */
  resetCardsStyle: (cardIds: readonly CardId[]) => void;
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
  /** Replaces the active board's content wholesale (restoring a backup).
      One undo step. */
  replaceBoardContent: (board: BoardState) => void;
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
  /** `cardOrder` as it was when the card being dragged was picked up, or
      `null` when no card drag is in progress. Live-session only, like
      `history`, and never persisted. */
  readonly cardDragOrigin: BoardState["cardOrder"] | null;
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

/** One undo or redo, or its refusal (see `undo` in the store below). */
function takeStep(state: BoardStore, action: "undo" | "redo", set: (update: Partial<BoardStore>) => void): void {
  if (state.cardDragOrigin) {
    return;
  }
  const step = (action === "undo" ? stepUndo : stepRedo)(state.history, boardContent(state));
  if (!step) {
    return;
  }
  set({ ...step.patch, history: step.history });
  if (step.conflicts.length > 0) {
    const linked = findLinkedMap(state.boardId);
    useSyncNotice.getState().refused(step.conflicts, action, linked !== null && !linked.inTrash);
  }
}

/**
 * The same fields set on several cards, as one `cards` patch -- the shape
 * every "one card from its panel, or the whole marquee selection" action
 * shares. Ids no longer on the board (a selection that outlived a delete)
 * are skipped rather than recreated as half-empty cards.
 */
function patchCards(state: BoardStore, cardIds: readonly CardId[], fields: Partial<Card>): BoardPatch {
  const cards = { ...state.cards };
  for (const cardId of cardIds) {
    if (cards[cardId]) {
      cards[cardId] = { ...cards[cardId], ...fields };
    }
  }
  return { cards };
}

/**
 * Loads a board to put on screen, and tells the recovery notice whether it
 * was damaged (see `openPersistedBoard`). Nothing saved, or nothing
 * salvageable, opens as an empty board -- the latter with the notice up and
 * the original kept aside, never silently.
 */
function openBoard(boardId: BoardId): BoardState {
  const { board, damage } = openPersistedBoard(boardId);
  useRecoveryStore.getState().setDamage(damage);
  return board ?? createEmptyBoard();
}

/** A board made in this session has no saved past to be damaged. */
function clearDamage(): void {
  useRecoveryStore.getState().setDamage(null);
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
 *  3. Neither -- a first-ever run, seeded with demo content the same way,
 *     and remembered as the starter board (`starterBoard.ts`): a new
 *     address offers restoring from a backup while it is the only board.
 */
function loadInitialState(): { boardId: BoardId; boards: readonly BoardSummary[]; board: BoardState } {
  const registry = loadPersistedRegistry();
  if (registry) {
    const board = openBoard(registry.activeBoardId);
    return { boardId: registry.activeBoardId, boards: registry.boards, board };
  }

  const boardId = createBoardId();
  const legacyBoard = loadLegacyPersistedBoard();
  const board = legacyBoard ?? createSeedBoard();
  const boards: BoardSummary[] = [{ id: boardId, name: "Untitled board" }];

  savePersistedBoardNow(board, boardId);
  savePersistedRegistryNow(boards, boardId);
  if (!legacyBoard) rememberStarterBoard(boardId);

  return { boardId, boards, board };
}

const initial = loadInitialState();
removeOrphanedSetAside(initial.boards.map((board) => board.id));

/** What a board's own content is made of: the slices saved with it, its
    undo history, and a drag in progress. */
const CONTENT_KEYS = [
  "lists",
  "cards",
  "listOrder",
  "cardOrder",
  "trash",
  "trashedLists",
  "background",
  "collapsedLists",
  "history",
  "cardDragOrigin",
] as const satisfies readonly (keyof BoardStore)[];

/**
 * A board a newer Boardkit saved is read-only (see `isReadOnlyBoard`). Rather
 * than every action checking that, every update goes through here, which
 * drops whatever it would change on such a board. Board-level updates still
 * pass: switching away, making or deleting a board, and the board list.
 * Edits started in the UI just don't take: a renamed title springs back, a
 * dragged card returns to its place.
 */
function withoutReadOnlyEdits(state: BoardStore, update: Partial<BoardStore>): Partial<BoardStore> {
  if (update === state || !isReadOnlyBoard(state.boardId)) return update;
  if (update.boardId !== undefined && update.boardId !== state.boardId) return update;
  const allowed: Partial<BoardStore> = { ...update };
  for (const key of CONTENT_KEYS) delete allowed[key];
  return allowed;
}

/** Zustand middleware: hands the store a `set` that passes every update
    through `withoutReadOnlyEdits`. Only the partial-update form of `set` is
    used in this store. */
const readOnlyGuard =
  (config: StateCreator<BoardStore>): StateCreator<BoardStore> =>
  (setState, get, api) => {
    const set = ((update: Partial<BoardStore> | ((state: BoardStore) => Partial<BoardStore>)) =>
      setState((state) =>
        withoutReadOnlyEdits(state, typeof update === "function" ? update(state) : update),
      )) as typeof setState;
    return config(set, get, api);
  };

export const useBoardStore = create<BoardStore>()(readOnlyGuard((set, get) => ({
  ...initial.board,
  boardId: initial.boardId,
  boards: initial.boards,
  history: EMPTY_HISTORY,
  cardDragOrigin: null,

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

  // A card drag is one transaction -- see `domain/cardDrag.ts`. These four
  // actions are its begin / preview / commit / rollback, and none of them go
  // through `withHistory`: the only history a drag produces is the single
  // entry `endCardDrag` settles on drop.
  beginCardDrag: () => set((state) => ({ cardDragOrigin: state.cardOrder })),

  // Called continuously as a drag crosses into a different list, not just on
  // drop -- see DragContext's onDragOver. That is what makes the destination
  // list open a gap for the card while it is still being dragged, rather
  // than the card only appearing there once the pointer is released. It is
  // still a real store write (each list's SortableContext reads its items
  // from the store), just not a recorded one.
  //
  // A full destination list refuses the card: it opens no gap, and the card
  // stays in the list it came from.
  moveCardBetweenLists: (activeId, fromListId, toListId, overId) =>
    set((state) => {
      if (isListFull(state.cardOrder[toListId])) {
        return state;
      }
      return {
        cardOrder: moveBetweenLists(state.cardOrder, activeId, fromListId, toListId, overId),
      };
    }),

  endCardDrag: (reorder) =>
    set((state) => {
      const cardOrder = reorder
        ? {
            ...state.cardOrder,
            [reorder.listId]: moveWithinList(
              state.cardOrder[reorder.listId],
              reorder.activeId,
              reorder.overId,
            ),
          }
        : state.cardOrder;
      if (!state.cardDragOrigin) {
        return { cardOrder };
      }
      return {
        ...settleCardDrag(state.history, state.cardDragOrigin, cardOrder),
        cardDragOrigin: null,
      };
    }),

  cancelCardDrag: () =>
    set((state) =>
      state.cardDragOrigin ? { cardOrder: state.cardDragOrigin, cardDragOrigin: null } : state,
    ),

  endCardDragInto: (activeId, fromListId, toListId) => {
    if (fromListId !== toListId && isListFull(get().cardOrder[toListId])) {
      get().cancelCardDrag();
      return;
    }
    if (fromListId !== toListId) {
      get().moveCardBetweenLists(activeId, fromListId, toListId, null);
    }
    get().endCardDrag(null);
  },

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
        lists: {
          ...state.lists,
          [listId]: { ...state.lists[listId], numberFormat: format, numbersHidden: undefined },
        },
      }),
    ),

  // `false` is stored as absent, like `continuesNumbering`.
  setListNumbersHidden: (listId, hidden) =>
    set((state) =>
      withHistory(state, {
        lists: {
          ...state.lists,
          [listId]: { ...state.lists[listId], numbersHidden: hidden || undefined },
        },
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

  // Deliberately not `withHistory`: see domain/collapse.ts.
  setListCollapsed: (listId, collapsed) =>
    set((state) => {
      const collapsedLists = withCollapsed(state.collapsedLists, listId, collapsed);
      return collapsedLists === state.collapsedLists ? state : { collapsedLists };
    }),

  expandListOf: (cardId) => {
    const listId = listOfCard(get().cardOrder, cardId);
    if (listId) get().setListCollapsed(listId, false);
  },

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

  setCardsNumberEmphasis: (cardIds, numberEmphasis) =>
    set((state) => withHistory(state, patchCards(state, cardIds, { numberEmphasis }))),

  setCardsHighlight: (cardIds, highlight) =>
    set((state) => withHistory(state, patchCards(state, cardIds, { highlight }))),

  setCardsHighlightStyle: (cardIds, highlightStyle) =>
    set((state) => withHistory(state, patchCards(state, cardIds, { highlightStyle }))),

  resetCardsStyle: (cardIds) =>
    set((state) =>
      withHistory(
        state,
        patchCards(state, cardIds, {
          numberEmphasis: undefined,
          highlight: undefined,
          highlightStyle: undefined,
        }),
      ),
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
  // A step whose items were changed in another tab (or Linkkit) since is
  // refused, and the user told why (`domain/history.ts`).
  //
  // Both are ignored mid-drag: undoing under a lifted card would rewrite the
  // `cardOrder` the drag is about to settle against its origin.
  undo: () => takeStep(get(), "undo", set),
  redo: () => takeStep(get(), "redo", set),

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
      clearDamage();
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
        collapsedLists: state.collapsedLists,
      };
      const boards = [...state.boards, { id: boardId, name }];
      savePersistedBoardNow(board, boardId);
      savePersistedRegistryNow(boards, boardId);
      clearDamage();
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
      clearDamage();
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
        allowBoardWrites(entry.id);
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
      const board = openBoard(nextId);
      return { ...board, boardId: nextId, boards, history: EMPTY_HISTORY };
    }),

  switchBoard: (boardId) =>
    set((state) => {
      if (boardId === state.boardId) return state;
      flushPersist();
      const board = openBoard(boardId);
      return { ...board, boardId, history: EMPTY_HISTORY };
    }),

  // Swaps the whole board for another copy of it -- a backup, when the saved
  // one was damaged. One undo step, so the repaired version is a Ctrl+Z away.
  // Collapse is a view setting outside history (see domain/collapse.ts), so
  // it is set alongside rather than inside the step.
  replaceBoardContent: (board) =>
    set((state) => ({
      ...withHistory(state, {
        lists: board.lists,
        cards: board.cards,
        listOrder: board.listOrder,
        cardOrder: board.cardOrder,
        trash: board.trash,
        trashedLists: board.trashedLists,
        background: board.background,
      }),
      collapsedLists: board.collapsedLists,
    })),

  renameBoard: (name) =>
    set((state) => ({
      boards: state.boards.map((board) => (board.id === state.boardId ? { ...board, name } : board)),
    })),
})));

// The only subscribers that exist outside a component: persist whichever
// slice changed, debounced, to `localStorage`. `history` is deliberately
// excluded from both comparisons and both writes -- undo stacks are a
// live-session convenience, not saved content, so a reload starts with a
// clean one.
//
// A card drag in progress is never saved: its preview moves are not a
// change until the card is dropped (`endCardDrag`), and Esc puts it all
// back. Other tabs' saves wait for the drop too (`whenNotDragging`).
useBoardStore.subscribe((state, previous) => {
  // After this update's own save is scheduled below, not in the middle of it.
  if (previous.cardDragOrigin && !state.cardDragOrigin && afterDrag.length > 0) {
    queueMicrotask(() => {
      for (const run of afterDrag.splice(0)) run();
    });
  }
  if (state.cardDragOrigin) return;
  if (
    state.lists !== previous.lists ||
    state.cards !== previous.cards ||
    state.listOrder !== previous.listOrder ||
    state.cardOrder !== previous.cardOrder ||
    state.trash !== previous.trash ||
    state.trashedLists !== previous.trashedLists ||
    state.background !== previous.background ||
    state.collapsedLists !== previous.collapsedLists
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

/*
 * Other tabs. Two tabs of Boardkit -- or, on the shared site, Boardkit and
 * Linkkit -- may have the same board open. Each saves the whole record, so
 * without this the last save would silently undo the other's changes.
 * Two halves:
 *
 *  - Every write checks the record's `rev` first and merges in what another
 *    tab stored since (`persistBoard.ts`, `domain/merge.ts`); the merged
 *    board comes back here through `onBoardMerged`.
 *  - The browser's `storage` event, which fires in every *other* tab of the
 *    same address when one tab writes, brings another tab's save in at
 *    once, merged with whatever this tab has not saved yet.
 *
 * Taking in another tab's change keeps this board's undo history (Linkkit's
 * plan, step 27): an undo then puts back only the items its step changed,
 * and is refused when one of them was changed in the other tab too
 * (`domain/history.ts`).
 */

/** Work held back until the card being dragged is dropped: applying another
    tab's board mid-drag would move cards out from under the pointer. */
const afterDrag: (() => void)[] = [];

function whenNotDragging(run: () => void): void {
  if (useBoardStore.getState().cardDragOrigin) afterDrag.push(run);
  else run();
}

/** Puts `board` on screen as the open board's content, keeping every object
    that didn't change (`shareUnchanged`), so only what the other tab
    changed re-renders. */
function adoptBoard(board: BoardState): void {
  useBoardStore.setState((state) => {
    const current = boardContent(state);
    const next = shareUnchanged(current, board);
    return next === current ? state : next;
  });
}

/** Another tab stored `boardId`. Only the open board needs anything now; any
    other board is read fresh when it is opened. */
function pullBoard(boardId: BoardId, removed: boolean): void {
  // Stored again (another tab restored it from a backup): writable again.
  if (!removed) allowBoardWrites(boardId);
  if (boardId !== useBoardStore.getState().boardId) {
    if (removed) forgetBoardDeletedElsewhere(boardId);
    return;
  }
  whenNotDragging(() => {
    const state = useBoardStore.getState();
    if (state.boardId !== boardId) return;
    const result = catchUpBoard(boardId, boardContent(state));
    if (result.kind === "merged") adoptBoard(result.board);
    // Opened again, read-only, with the "newer Boardkit" notice.
    else if (result.kind === "newer") useBoardStore.setState({ ...openBoard(boardId), history: EMPTY_HISTORY });
    // "deleted": the board list's own event, a moment later, switches away.
  });
}

/**
 * Shows another tab's board list, merged with this tab's: boards it added
 * appear, boards it renamed are renamed. A board it deleted goes from the
 * list; if that was the open board, the newest board left opens and the
 * user is told. `from` is the list `merged` was worked out from: if this
 * tab's list has moved on since, the two are merged again.
 */
function adoptBoardList(from: readonly BoardSummary[], merged: BoardListCatchUp): void {
  const state = useBoardStore.getState();
  const boards = sameValue(state.boards, from)
    ? merged.boards
    : mergeBoardLists(from, state.boards, merged.boards).boards;
  const gone = state.boards.filter((board) => !boards.some((kept) => kept.id === board.id));
  for (const board of gone) forgetBoardDeletedElsewhere(board.id);

  const goneIds = new Set<string>(gone.map((board) => board.id));
  const notice = useSyncNotice.getState();
  notice.conflicted(merged.conflicts.filter((conflict) => !goneIds.has(conflict.id ?? "")));

  const active = gone.find((board) => board.id === state.boardId);
  if (active && boards.length > 0) {
    const nextId = boards[boards.length - 1].id;
    useBoardStore.setState({ ...openBoard(nextId), boardId: nextId, boards, history: EMPTY_HISTORY });
    notice.boardDeleted(active.name);
  } else if (!sameValue(boards, state.boards)) {
    useBoardStore.setState({ boards });
  }
}

// A write that merged in another tab's save. Applied once the current store
// update is over: a write can happen inside one (switching boards flushes the
// outgoing board's save), and setting state from inside it would be lost.
onBoardMerged((boardId, from, merged) =>
  queueMicrotask(() =>
    whenNotDragging(() => {
      const state = useBoardStore.getState();
      if (state.boardId !== boardId || isReadOnlyBoard(boardId)) return;
      // If this tab changed the board again since `from`, that change is
      // kept on top too.
      adoptBoard(mergeBoards(from, boardContent(state), merged).board);
    }),
  ),
);
onBoardListMerged((from, merged) => queueMicrotask(() => adoptBoardList(from, merged)));

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    // `key` is null when another tab cleared all of storage: nothing to merge.
    if (event.key === null || event.storageArea !== localStorage) return;
    if (isBoardListKey(event.key)) {
      const { boards } = useBoardStore.getState();
      const merged = catchUpBoardList(boards);
      if (merged) adoptBoardList(boards, merged);
      return;
    }
    const boardId = boardIdOfKey(event.key);
    if (boardId) pullBoard(boardId, event.newValue === null);
  });
}
