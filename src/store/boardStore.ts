import { create } from "zustand";

import { createCardId, createListId } from "../domain/ids";
import { moveWithinList } from "../domain/ordering";
import { createSeedBoard } from "../domain/seed";
import type { BoardState, CardId, ListId } from "../domain/types";

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
}

export type BoardStore = BoardState & BoardActions;

export const useBoardStore = create<BoardStore>((set) => ({
  ...createSeedBoard(),

  addList: (title) =>
    set((state) => {
      const id = createListId();
      return {
        lists: { ...state.lists, [id]: { id, title } },
        listOrder: [...state.listOrder, id],
        cardOrder: { ...state.cardOrder, [id]: [] },
      };
    }),

  addCard: (listId, title) =>
    set((state) => {
      const id = createCardId();
      return {
        cards: { ...state.cards, [id]: { id, title } },
        cardOrder: {
          ...state.cardOrder,
          [listId]: [...state.cardOrder[listId], id],
        },
      };
    }),

  renameList: (listId, title) =>
    set((state) => ({
      lists: { ...state.lists, [listId]: { ...state.lists[listId], title } },
    })),

  renameCard: (cardId, title) =>
    set((state) => ({
      cards: { ...state.cards, [cardId]: { ...state.cards[cardId], title } },
    })),

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

      return {
        lists,
        cards,
        cardOrder,
        listOrder: state.listOrder.filter((id) => id !== listId),
      };
    }),

  // `listId` is required here because a card does not store which list it
  // belongs to -- that membership lives only in `cardOrder`, so removing a
  // card means splicing it out of its list's array.
  deleteCard: (listId, cardId) =>
    set((state) => {
      const cards = { ...state.cards };
      delete cards[cardId];
      return {
        cards,
        cardOrder: {
          ...state.cardOrder,
          [listId]: state.cardOrder[listId].filter((id) => id !== cardId),
        },
      };
    }),

  // A thin wrapper over the pure domain function: the store's only job is to
  // put the result back into the normalised shape.
  reorderCardsWithinList: (listId, activeId, overId) =>
    set((state) => ({
      cardOrder: {
        ...state.cardOrder,
        [listId]: moveWithinList(state.cardOrder[listId], activeId, overId),
      },
    })),
}));
