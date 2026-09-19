import { create } from "zustand";

interface ShortcutsDialogStore {
  readonly isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
}

/**
 * Whether the shortcuts dialog is open. It has a store of its own because two
 * unrelated places need to flip it: the toolbar button that owns the dialog,
 * and the `?` shortcut, which lives in the shortcut registry. Transient UI
 * state, like selection -- never saved, never undoable.
 */
export const useShortcutsDialogStore = create<ShortcutsDialogStore>((set) => ({
  isOpen: false,
  setOpen: (isOpen) => set({ isOpen }),
}));
