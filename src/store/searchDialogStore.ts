import { create } from "zustand";

interface SearchDialogStore {
  readonly isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
}

/**
 * Whether the search dialog is open. Its own store for the same reason as
 * `shortcutsDialogStore.ts`: the toolbar button that owns the dialog and the
 * Ctrl/Cmd+K shortcut, which lives in the shortcut registry, both need to
 * flip it. Transient UI state -- never saved, never undoable.
 */
export const useSearchDialogStore = create<SearchDialogStore>((set) => ({
  isOpen: false,
  setOpen: (isOpen) => set({ isOpen }),
}));
