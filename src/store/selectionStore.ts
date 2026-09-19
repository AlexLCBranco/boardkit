import { create } from "zustand";

import { cardsInBoardOrder } from "../domain/clipboard";
import type { Card, CardId, ListId } from "../domain/types";
import { useBoardStore } from "./boardStore";

type Selected = Readonly<Record<CardId, true>>;

interface SelectionStore {
  /** Cards picked with the marquee, as a flat lookup so a card can ask
      "am I selected?" as a boolean and re-render only when that flips. */
  readonly selected: Selected;
  /** Snapshot of the last copied cards. Lives here, not on the board: it is
      not saved, and it survives switching boards, so a copy can be pasted
      into a different board. */
  readonly clipboard: readonly Card[];
  setSelected: (ids: readonly CardId[]) => void;
  clearSelection: () => void;
  copySelection: () => void;
  pasteInto: (listId: ListId) => void;
  /** Forgets the copied cards, so the per-list paste buttons go away. */
  clearClipboard: () => void;
}

const NOTHING: Selected = {};

/**
 * Selection is a separate store from the board. It is transient UI state --
 * never persisted, never undoable -- and keeping it out of `useBoardStore`
 * means a marquee sweeping over cards can never touch `history` or trigger a
 * board save.
 */
export const useSelectionStore = create<SelectionStore>((set, get) => ({
  selected: NOTHING,
  clipboard: [],

  // Called on every pointer move of a marquee, so an unchanged set must not
  // produce a new `selected` object.
  setSelected: (ids) =>
    set((state) => {
      const current = Object.keys(state.selected);
      if (current.length === ids.length && ids.every((id) => state.selected[id])) {
        return state;
      }
      return { selected: Object.fromEntries(ids.map((id) => [id, true])) as Selected };
    }),

  clearSelection: () =>
    set((state) => (state.selected === NOTHING ? state : { selected: NOTHING })),

  copySelection: () => {
    const cards = cardsInBoardOrder(useBoardStore.getState(), get().selected);
    if (cards.length > 0) {
      set({ clipboard: cards });
    }
  },

  clearClipboard: () => set((state) => (state.clipboard.length === 0 ? state : { clipboard: [] })),

  pasteInto: (listId) => {
    const { clipboard } = get();
    if (clipboard.length > 0) {
      useBoardStore.getState().pasteCards(listId, clipboard);
    }
  },
}));

// A selection points at cards on the board being viewed. Switching boards
// clears it; deleting a card (or a list) drops just the ids that left, so the
// count shown never includes something that is no longer there. Skipped when
// nothing is selected, since this runs on every board update -- including
// each frame of a drag.
useBoardStore.subscribe((state, previous) => {
  const selection = useSelectionStore.getState();
  if (selection.selected === NOTHING) {
    return;
  }
  if (state.boardId !== previous.boardId) {
    selection.clearSelection();
    return;
  }
  if (state.cardOrder !== previous.cardOrder || state.listOrder !== previous.listOrder) {
    const onBoard = new Set(state.listOrder.flatMap((listId) => state.cardOrder[listId]));
    selection.setSelected((Object.keys(selection.selected) as CardId[]).filter((id) => onBoard.has(id)));
  }
});
