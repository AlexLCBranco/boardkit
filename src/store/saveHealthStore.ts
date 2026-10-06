import { create } from "zustand";

interface SaveHealth {
  /** The storage keys whose latest write failed (storage full, or blocked).
      Empty when everything saved. */
  readonly failing: readonly string[];
  /** Records how a write to `key` went. */
  report: (key: string, ok: boolean) => void;
  /** Stops tracking a key that was removed on purpose (a deleted board). */
  forget: (key: string) => void;
}

/**
 * Whether saving works. `persistBoard.ts` and `persistRegistry.ts` report
 * every write; the banner (`features/board/SaveFailedNotice.tsx`) shows
 * while any key is failing and goes away by itself once each one has saved
 * again. Tracked per key, so a
 * small write that still fits (the board list) can't hide a big one that
 * doesn't (the board itself). Never saved, never undoable.
 */
export const useSaveHealth = create<SaveHealth>((set, get) => ({
  failing: [],
  report: (key, ok) => {
    const failing = get().failing;
    const known = failing.includes(key);
    if (ok && known) set({ failing: failing.filter((k) => k !== key) });
    else if (!ok && !known) set({ failing: [...failing, key] });
  },
  forget: (key) => get().report(key, true),
}));
