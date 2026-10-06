import { create } from "zustand";

import { cardTrashOverflow, listTrashOverflow } from "../domain/trash";
import { useBoardStore } from "./boardStore";

export type TrashKind = "card" | "list";

interface TrashWarningStore {
  /** A delete waiting for the user's OK because the trash it goes into is
      full. `run` performs it; the dialog calls it on confirm. */
  readonly pending: { readonly kind: TrashKind; readonly run: () => void } | null;
  ask: (kind: TrashKind, run: () => void) => void;
  close: () => void;
}

/**
 * The "trash is full" warning (`features/board/TrashFullDialog.tsx`). A store
 * of its own because every place that deletes -- a card's × button, the
 * Delete key, "Move to board" -- has to be able to open the one dialog.
 * Transient UI state, like the shortcuts dialog: never saved, never undoable.
 */
export const useTrashWarningStore = create<TrashWarningStore>((set) => ({
  pending: null,
  ask: (kind, run) => set({ pending: { kind, run } }),
  close: () => set({ pending: null }),
}));

/**
 * Runs `run` (a delete into the card or list trash) straight away when there
 * is room in that trash. When it is full -- so the delete would erase the
 * oldest entry for good -- it asks first instead, and `run` happens only if
 * the user confirms.
 */
export function guardTrash(kind: TrashKind, run: () => void): void {
  const board = useBoardStore.getState();
  const overflow = kind === "card" ? cardTrashOverflow(board) : listTrashOverflow(board);
  if (overflow) useTrashWarningStore.getState().ask(kind, run);
  else run();
}

type BoardSnapshot = ReturnType<typeof useBoardStore.getState>;

/** What one more delete into a full trash would erase, in words, or "" when
    that trash has room. */
function describeErased(state: BoardSnapshot, kind: TrashKind): string {
  if (kind === "card") {
    const entry = cardTrashOverflow(state);
    if (!entry) return "";
    const title = state.cards[entry.cardId]?.title;
    return title ? `the oldest card in it, “${title}”` : "the oldest card in it";
  }
  const entry = listTrashOverflow(state);
  if (!entry) return "";
  const title = state.lists[entry.listId]?.title;
  const count = state.cardOrder[entry.listId]?.length ?? 0;
  const cards = `${count} card${count === 1 ? "" : "s"}`;
  return title ? `the oldest list in it, “${title}”, with its ${cards}` : `the oldest list in it, with its ${cards}`;
}

/** `describeErased` as a hook. A string, so a component re-renders only
    when the words change, and always current (an undo can change the trash
    while a dialog is open). `null` reads nothing and returns "". */
export function useErasedDescription(kind: TrashKind | null): string {
  return useBoardStore((state) => (kind ? describeErased(state, kind) : ""));
}
