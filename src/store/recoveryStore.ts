import { create } from "zustand";

import type { BoardDamage } from "./persistBoard";

/**
 * Whether the board on screen was damaged when it was opened, and so shows
 * the recovery notice. Its own store, like `backupStore`, because it is
 * about how a board was loaded, not what is on it: never undone, never saved.
 *
 * Set by `boardStore` every time a board is opened (`null` when it read
 * cleanly), and cleared by `features/board/recovery.ts` once the user has
 * chosen what to keep. Switching away and back re-reads storage, so an
 * unresolved board shows the notice again rather than it being forgotten.
 */
interface RecoveryState {
  readonly damage: BoardDamage | null;
  readonly setDamage: (damage: BoardDamage | null) => void;
}

export const useRecoveryStore = create<RecoveryState>((set) => ({
  damage: null,
  setDamage: (damage) => set({ damage }),
}));
