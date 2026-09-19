import { create } from "zustand";

import type { ItemColor } from "../domain/types";

/**
 * The colour being tried in the background picker but not saved yet, so the
 * board can show it live while the picker is dragged. Kept out of the board
 * store on purpose: a preview is not board content, so it must never reach
 * undo history or storage -- the picker saves once, when the drag ends.
 */
interface BackgroundPreviewState {
  readonly color: ItemColor | null;
  readonly setColor: (color: ItemColor | null) => void;
}

export const useBackgroundPreviewStore = create<BackgroundPreviewState>((set) => ({
  color: null,
  setColor: (color) => set({ color }),
}));
