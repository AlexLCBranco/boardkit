import { computeCardNumber } from "../domain/numbering";
import type {
  BoardId,
  BoardSummary,
  Card,
  CardId,
  List,
  ListId,
  TrashEntry,
  TrashedListEntry,
} from "../domain/types";
import { useBoardStore } from "./boardStore";

/**
 * The selector layer: every subscription the UI makes, in one reviewable file.
 *
 * Components never write inline selectors. Keeping them here means the
 * question "what causes this component to re-render?" is answered by reading
 * one file, and a selector that accidentally subscribes too broadly is
 * obvious rather than buried in a component.
 *
 * Two rules govern everything below.
 *
 * 1. Return a value that already exists in the store. Zustand compares the
 *    previous and next selector results with `Object.is`. A selector that
 *    builds something new on each call -- `cardIds.map(...)`, `{ ...card }`,
 *    `Object.values(...)` -- returns a fresh reference every time and so is
 *    treated as a change on every store update. That is the single most
 *    common way to make a Zustand app slow.
 *
 * 2. Subscribe to the narrowest slice possible. A card reads its own entry
 *    and nothing else, so editing one card cannot re-render its siblings.
 */

/** Left-to-right order of the columns. Stable array reference. */
export function useListOrder(): readonly ListId[] {
  return useBoardStore((state) => state.listOrder);
}

/** One list's own data. Changes only when that list changes. */
export function useList(listId: ListId): List {
  return useBoardStore((state) => state.lists[listId]);
}

/**
 * The card ids inside one list. This is the slice a column re-renders on:
 * adding, removing or reordering cards changes this array, while editing a
 * card's title does not touch it.
 */
export function useCardIds(listId: ListId): readonly CardId[] {
  return useBoardStore((state) => state.cardOrder[listId]);
}

/** One card's own data. The narrowest subscription in the app. */
export function useCard(cardId: CardId): Card {
  return useBoardStore((state) => state.cards[cardId]);
}

/**
 * How many cards a list holds.
 *
 * Deriving a number rather than returning the array keeps the subscription
 * cheap: a header showing a count re-renders when the count changes, not
 * whenever the order does. Numbers compare by value, so this is safe to
 * compute in a selector -- unlike a new array or object.
 */
export function useCardCount(listId: ListId): number {
  return useBoardStore((state) => state.cardOrder[listId].length);
}

/**
 * Action selectors.
 *
 * Each one returns a single function, not an object of functions. Zustand
 * actions keep the same reference for the store's whole lifetime, so
 * `Object.is` sees no change and a component wiring up `useRenameCard` never
 * re-renders because of it. Bundling several actions into one selector would
 * return a fresh object on every call and defeat that -- rule 1 above, applied
 * to functions instead of data.
 */
export function useAddList() {
  return useBoardStore((state) => state.addList);
}

export function useAddCard() {
  return useBoardStore((state) => state.addCard);
}

export function useRenameList() {
  return useBoardStore((state) => state.renameList);
}

export function useRenameCard() {
  return useBoardStore((state) => state.renameCard);
}

export function useDeleteList() {
  return useBoardStore((state) => state.deleteList);
}

export function useDuplicateList() {
  return useBoardStore((state) => state.duplicateList);
}

export function useDeleteCard() {
  return useBoardStore((state) => state.deleteCard);
}

/** Trashed cards, oldest first. Stable array reference -- only changes on
    delete, restore, permanent delete or empty. */
export function useTrash(): readonly TrashEntry[] {
  return useBoardStore((state) => state.trash);
}

export function useTrashCount(): number {
  return useBoardStore((state) => state.trash.length);
}

export function useRestoreCard() {
  return useBoardStore((state) => state.restoreCard);
}

export function usePermanentlyDeleteCard() {
  return useBoardStore((state) => state.permanentlyDeleteCard);
}

export function useEmptyTrash() {
  return useBoardStore((state) => state.emptyTrash);
}

/** Whether a list is currently on the board, as opposed to sitting in the
    list trash (or gone for good) -- its own record can exist in either
    case, so this is what a trashed card's row checks before offering to
    restore into it. */
export function useListIsOnBoard(listId: ListId): boolean {
  return useBoardStore((state) => state.listOrder.includes(listId));
}

/** Trashed lists, oldest first. Stable array reference -- only changes on
    delete, restore, permanent delete or empty. */
export function useTrashedLists(): readonly TrashedListEntry[] {
  return useBoardStore((state) => state.trashedLists);
}

export function useTrashedListsCount(): number {
  return useBoardStore((state) => state.trashedLists.length);
}

export function useRestoreList() {
  return useBoardStore((state) => state.restoreList);
}

export function usePermanentlyDeleteList() {
  return useBoardStore((state) => state.permanentlyDeleteList);
}

export function useEmptyListTrash() {
  return useBoardStore((state) => state.emptyListTrash);
}

export function useReorderCardsWithinList() {
  return useBoardStore((state) => state.reorderCardsWithinList);
}

export function useMoveCardBetweenLists() {
  return useBoardStore((state) => state.moveCardBetweenLists);
}

export function useReorderLists() {
  return useBoardStore((state) => state.reorderLists);
}

/**
 * A card's display number (its 1-based position within its own list).
 *
 * This is the one selector in this file that returns a value computed fresh
 * on every call rather than read straight from the store -- a number is a
 * primitive, so rule 1 still holds: `Object.is` compares it by value, not by
 * reference, so a card only re-renders for this when its actual position
 * changes.
 */
export function useCardNumber(listId: ListId, cardId: CardId): number | null {
  return useBoardStore((state) => computeCardNumber(state.cardOrder, listId, cardId));
}

export function useSetListColor() {
  return useBoardStore((state) => state.setListColor);
}

export function useSetListIcon() {
  return useBoardStore((state) => state.setListIcon);
}

export function useSetListWidths() {
  return useBoardStore((state) => state.setListWidths);
}

export function useSetCardColor() {
  return useBoardStore((state) => state.setCardColor);
}

export function useSetCardDescription() {
  return useBoardStore((state) => state.setCardDescription);
}

export function useSetCardPostgameDescription() {
  return useBoardStore((state) => state.setCardPostgameDescription);
}

export function useUndo() {
  return useBoardStore((state) => state.undo);
}

export function useRedo() {
  return useBoardStore((state) => state.redo);
}

/** Booleans, not the stacks themselves -- a component that only needs to
 * know whether a button should be enabled must not re-render on every
 * change to a stack it never reads the contents of. */
export function useCanUndo(): boolean {
  return useBoardStore((state) => state.history.past.length > 0);
}

export function useCanRedo(): boolean {
  return useBoardStore((state) => state.history.future.length > 0);
}

/** The active board's id. Changes only when the user switches or creates a
    board, never on an ordinary edit. */
export function useBoardId(): BoardId {
  return useBoardStore((state) => state.boardId);
}

/** Every board's id and name, for a switcher to list. Stable array
    reference -- it only changes on create, switch or rename. */
export function useBoards(): readonly BoardSummary[] {
  return useBoardStore((state) => state.boards);
}

/** The active board's own name, derived from `boards` rather than stored
    twice. A plain string, so `Object.is` still holds (rule 1 above). */
export function useActiveBoardName(): string {
  return useBoardStore(
    (state) => state.boards.find((board) => board.id === state.boardId)?.name ?? "Untitled board",
  );
}

export function useCreateBoard() {
  return useBoardStore((state) => state.createBoard);
}

export function useDuplicateBoard() {
  return useBoardStore((state) => state.duplicateBoard);
}

export function useDeleteBoard() {
  return useBoardStore((state) => state.deleteBoard);
}

export function useSwitchBoard() {
  return useBoardStore((state) => state.switchBoard);
}

export function useRenameBoard() {
  return useBoardStore((state) => state.renameBoard);
}
