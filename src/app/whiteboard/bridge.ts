import { takeStoredElsewhere } from "../../store/boardStore";
import { onWroteHere } from "../../store/storedHere";

/**
 * The gauntlet whiteboard shows Boardkit's boards and Linkkit's maps on one
 * page. The browser's `storage` event tells only OTHER tabs of a write, so
 * the two apps on that page tell each other here: the whiteboard passes
 * Linkkit's writes in (`keyStoredElsewhere`, as if another tab had made
 * them: a map linked to a board writes that board), and Boardkit's own
 * writes out (`onWroteHere`).
 */

type KeyListener = (key: string) => void;

const fromLinkkit = new Set<KeyListener>();

/** Linkkit, on this page, stored (or removed: `removed`) storage key `key`:
    taken in as another tab's write, and shown. */
export function keyStoredElsewhere(key: string, removed = false): void {
  takeStoredElsewhere(key, removed);
  for (const listener of [...fromLinkkit]) listener(key);
}

/** Calls `listener` with each key Linkkit stored on this page. Returns a
    stop function. */
export function onLinkkitStored(listener: KeyListener): () => void {
  fromLinkkit.add(listener);
  return () => fromLinkkit.delete(listener);
}

export { onWroteHere };
