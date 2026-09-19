import { create } from "zustand";

import type { ItemColor } from "../domain/types";

/**
 * What is being tried in the background panel but not saved yet, so the board
 * can show it live while a colour picker or the image dimming slider is
 * dragged. Kept out of the board store on purpose: a preview is not board
 * content, so it must never reach undo history or storage -- the panel saves
 * once, when the drag ends.
 */
interface BackgroundPreviewState {
  /** A colour being tried; wins over whatever is saved. */
  readonly color: ItemColor | null;
  /** A dimming strength being tried on the saved image. */
  readonly wash: number | null;
  readonly setColor: (color: ItemColor | null) => void;
  readonly setWash: (wash: number | null) => void;
}

export const useBackgroundPreviewStore = create<BackgroundPreviewState>((set) => ({
  color: null,
  wash: null,
  setColor: (color) => set({ color }),
  setWash: (wash) => set({ wash }),
}));
