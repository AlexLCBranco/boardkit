import { useShallow } from "zustand/react/shallow";

import type { AutoBackupStatus } from "../domain/backupStatus";
import { isListFull } from "../domain/limits";
import { numberCards, numberingOffset } from "../domain/numbering";
import type {
  BoardBackground,
  BoardId,
  BoardSummary,
  Card,
  CardId,
  HexColor,
  ItemColor,
  List,
  ListId,
  TrashEntry,
  TrashedListEntry,
} from "../domain/types";
import { useBackupStore } from "./backupStore";
import { useBoardStore } from "./boardStore";
import { useRecentColorsStore } from "./recentColorsStore";
import { useSearchDialogStore } from "./searchDialogStore";
import { useSelectionStore } from "./selectionStore";
import { useShortcutsDialogStore } from "./shortcutsDialogStore";

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
/**
 * Just a list's colour, for a card that needs it (to pick readable text on the
 * list's tint) without re-rendering when the list is renamed or resized.
 */
export function useListColor(listId: ListId): ItemColor | undefined {
  return useBoardStore((state) => state.lists[listId].color);
}

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
 * Whether a list has reached the per-list card limit. A boolean, so a
 * subscriber re-renders only when the list crosses the limit, not on every
 * card added below it. Tolerates a list id with no `cardOrder` entry (a
 * trash entry whose list was permanently deleted) by reporting not-full.
 */
export function useIsListFull(listId: ListId): boolean {
  return useBoardStore((state) => {
    const cardIds = state.cardOrder[listId];
    return cardIds !== undefined && isListFull(cardIds);
  });
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
 * Every card's display number in one list, in card order (`null` for a card
 * type that isn't numbered).
 *
 * Computed fresh on every store update, so it is compared with `useShallow`:
 * the column re-renders only when a number actually changes, not whenever a
 * new-but-equal array comes back. Its cost is one pass over this list plus
 * the lists it continues from -- short by design, so cheap even mid-drag.
 * Each card still gets its number as a primitive prop, so only the cards
 * whose number changed re-render.
 */
export function useCardNumbers(listId: ListId): readonly (number | null)[] {
  return useBoardStore(
    useShallow((state) =>
      numberCards(
        state.cardOrder[listId],
        state.cards,
        numberingOffset(state.listOrder, state.lists, state.cardOrder, state.cards, listId),
      ),
    ),
  );
}

/**
 * One card's display number, wherever it currently sits (`null` for a card
 * type that isn't numbered, or a card in no list). For the drag overlay,
 * which is the only thing that needs a single card's number: it follows the
 * card across lists mid-drag, so it can't take a fixed list id.
 */
export function useCardNumber(cardId: CardId): number | null {
  return useBoardStore((state) => {
    const listId = state.listOrder.find((id) => state.cardOrder[id]?.includes(cardId));
    if (listId === undefined) {
      return null;
    }
    const numbers = numberCards(
      state.cardOrder[listId],
      state.cards,
      numberingOffset(state.listOrder, state.lists, state.cardOrder, state.cards, listId),
    );
    return numbers[state.cardOrder[listId].indexOf(cardId)] ?? null;
  });
}

/** Whether this is the leftmost list -- the one list with nothing to
    continue numbering from. A boolean, so reordering other lists never
    re-renders this one. */
export function useIsFirstList(listId: ListId): boolean {
  return useBoardStore((state) => state.listOrder[0] === listId);
}

/** Whether the list to the right continues this one's numbering -- so this
    list is the start (or middle) of a run and shows its number range too. */
export function useIsNumberingContinued(listId: ListId): boolean {
  return useBoardStore((state) => {
    const next = state.listOrder[state.listOrder.indexOf(listId) + 1];
    return next !== undefined && state.lists[next]?.continuesNumbering === true;
  });
}

export function useSetListContinuesNumbering() {
  return useBoardStore((state) => state.setListContinuesNumbering);
}

export function useSetListNumberFormat() {
  return useBoardStore((state) => state.setListNumberFormat);
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

export function useBackground(): BoardBackground | undefined {
  return useBoardStore((state) => state.background);
}

export function useSetBackground() {
  return useBoardStore((state) => state.setBackground);
}

export function useSetCardKind() {
  return useBoardStore((state) => state.setCardKind);
}

export function useSetCardColor() {
  return useBoardStore((state) => state.setCardColor);
}

export function useSetCardHighlight() {
  return useBoardStore((state) => state.setCardHighlight);
}

export function useSetCardHighlightStyle() {
  return useBoardStore((state) => state.setCardHighlightStyle);
}

export function useSetCardsNumberEmphasis() {
  return useBoardStore((state) => state.setCardsNumberEmphasis);
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

export function useCreateBoardFromLayout() {
  return useBoardStore((state) => state.createBoardFromLayout);
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

export function useSendCardToBoard() {
  return useBoardStore((state) => state.sendCardToBoard);
}

export function useSendListToBoard() {
  return useBoardStore((state) => state.sendListToBoard);
}

/* Selection and the copy clipboard live in their own store
   (`selectionStore.ts`): transient UI state, never saved or undoable. */

/** Whether one card is selected. A boolean, so sweeping a marquee re-renders
    only the cards it actually gains or loses. */
export function useIsCardSelected(cardId: CardId): boolean {
  return useSelectionStore((state) => state.selected[cardId] === true);
}

export function useSelectedCount(): number {
  return useSelectionStore((state) => Object.keys(state.selected).length);
}

/** How many cards a paste would bring in. */
export function useClipboardCount(): number {
  return useSelectionStore((state) => state.clipboard.length);
}

/** Changes on every copy, even of the same cards -- what "Copied" keys off. */
export function useClipboard(): readonly Card[] {
  return useSelectionStore((state) => state.clipboard);
}

export function useSetSelectedCards() {
  return useSelectionStore((state) => state.setSelected);
}

export function useClearSelection() {
  return useSelectionStore((state) => state.clearSelection);
}

export function useCopySelection() {
  return useSelectionStore((state) => state.copySelection);
}

export function useClearClipboard() {
  return useSelectionStore((state) => state.clearClipboard);
}

export function usePasteInto() {
  return useSelectionStore((state) => state.pasteInto);
}

/** A one-off read for event handlers (a marquee starting with Shift held).
    Deliberately not a hook: subscribing would re-render the caller on every
    selection change. */
export function readSelectedCardIds(): CardId[] {
  return Object.keys(useSelectionStore.getState().selected) as CardId[];
}

/* Backups live in their own store (`backupStore.ts`): they are per browser,
   not part of any board. */

export function useLastBackupAt(): number | null {
  return useBackupStore((state) => state.lastBackupAt);
}

export function useAutoBackupStatus(): AutoBackupStatus {
  return useBackupStore((state) => state.status);
}

export function useBackupFolderName(): string | null {
  return useBackupStore((state) => state.folderName);
}

export function useBackupWarning(): string | null {
  return useBackupStore((state) => state.warning);
}

/* The shortcuts dialog's open state lives in `shortcutsDialogStore.ts`. */

export function useIsShortcutsDialogOpen(): boolean {
  return useShortcutsDialogStore((state) => state.isOpen);
}

export function useSetShortcutsDialogOpen() {
  return useShortcutsDialogStore((state) => state.setOpen);
}

/* The search dialog's open state lives in `searchDialogStore.ts`. */

export function useIsSearchOpen(): boolean {
  return useSearchDialogStore((state) => state.isOpen);
}

export function useSetSearchOpen() {
  return useSearchDialogStore((state) => state.setOpen);
}

/** The custom colours picked lately, most recent first -- per browser. */
export function useRecentColors(): readonly HexColor[] {
  return useRecentColorsStore((state) => state.recent);
}

export function useRememberColor() {
  return useRecentColorsStore((state) => state.remember);
}

export function useForgetColor() {
  return useRecentColorsStore((state) => state.forget);
}
