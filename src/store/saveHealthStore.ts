import { create } from "zustand";

interface SaveHealth {
  /** The storage keys whose latest write failed (storage full, or blocked).
      Empty when everything saved. */
  readonly failing: readonly string[];
  /** Records how a write to `key` went. A failed write passes `retry`, which
      makes that same write again; `retryAll` calls it. */
  report: (key: string, ok: boolean, retry?: () => void) => void;
  /** Stops tracking a key that was removed on purpose (a deleted board). */
  forget: (key: string) => void;
  /** Makes every failed write again, each with the content it last tried
      to store -- including boards that aren't open (a new, duplicated or
      imported board), whose content is no longer anywhere else. */
  retryAll: () => void;
}

/** The latest failed write per key, kept out of the store's state: it holds
    whole boards and nothing renders from it. */
const retries = new Map<string, () => void>();

/**
 * Whether saving works. `persistBoard.ts` and `persistRegistry.ts` report
 * every write; the banner (`features/board/SaveFailedNotice.tsx`) shows
 * while any key is failing and goes away by itself once each one has saved
 * again. Tracked per key, so a small write that still fits (the board list)
 * can't hide a big one that doesn't (the board itself). Never saved, never
 * undoable.
 */
export const useSaveHealth = create<SaveHealth>((set, get) => ({
  failing: [],
  report: (key, ok, retry) => {
    if (ok) retries.delete(key);
    else if (retry) retries.set(key, retry);
    const failing = get().failing;
    const known = failing.includes(key);
    if (ok && known) set({ failing: failing.filter((k) => k !== key) });
    else if (!ok && !known) set({ failing: [...failing, key] });
  },
  forget: (key) => get().report(key, true),
  retryAll: () => {
    // A copy: each retry reports again, which edits the map.
    for (const retry of [...retries.values()]) retry();
  },
}));
