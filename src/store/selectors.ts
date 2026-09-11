import type { Card, CardId, List, ListId } from "../domain/types";
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

export function useDeleteCard() {
  return useBoardStore((state) => state.deleteCard);
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
