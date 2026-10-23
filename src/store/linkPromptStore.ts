import { create } from "zustand";

import type { CardId, ListId } from "../domain/types";

/** What a link is set on. */
export type LinkTarget =
  | { readonly kind: "card"; readonly cardId: CardId }
  | { readonly kind: "list"; readonly listId: ListId }
  | { readonly kind: "board" };

interface LinkPromptStore {
  /** The object whose link field is open, or `null`. One at a time. */
  readonly target: LinkTarget | null;
  /** Where the field opens, in viewport pixels (its top-left corner). */
  readonly at: { readonly x: number; readonly y: number };
  open: (target: LinkTarget, at: { readonly x: number; readonly y: number }) => void;
  close: () => void;
}

/**
 * Which link field is open (`features/board/LinkPromptHost.tsx` draws it).
 * Transient UI state, like the selection: never saved, never undone. A
 * menu item or Ctrl+K opens it; saving goes through the board store, one
 * undo step.
 */
export const useLinkPromptStore = create<LinkPromptStore>((set) => ({
  target: null,
  at: { x: 0, y: 0 },
  open: (target, at) => set({ target, at }),
  close: () => set((state) => (state.target === null ? state : { target: null })),
}));

/** Opens the link field for `target` just under `element` (or at the
    window's top-left quarter when there is none on screen). */
export function openLinkPromptBelow(target: LinkTarget, element: Element | null): void {
  const r = element?.getBoundingClientRect();
  useLinkPromptStore.getState().open(target, r ? { x: r.left, y: r.bottom + 4 } : { x: window.innerWidth / 4, y: window.innerHeight / 4 });
}
