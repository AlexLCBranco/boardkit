import { imageIdOf } from "../domain/background";
import type { BoardSummary, ImageId } from "../domain/types";
import { idbDelete, idbGet, idbKeys, idbSet } from "./idb";
import { flushPersist, loadPersistedBoard } from "./persistBoard";
import { loadPersistedRegistry } from "./persistRegistry";

/**
 * Board background images, kept in IndexedDB.
 *
 * `localStorage` holds about 5 MB for the whole app, shared by every board;
 * one photo can be several. IndexedDB holds far more and stores a `Blob` as
 * it is, so an image is saved here under its id and the board keeps only that
 * id (`BoardBackground`). Same shape as `persistBoard.ts`: this module owns
 * where images live; `domain/` owns what a background is.
 *
 * Every function tolerates IndexedDB being unavailable (a private window,
 * blocked site data): reads answer "no image", and `saveImage` rejects so the
 * caller can say so. A missing image is never an error on screen -- the board
 * falls back to the theme's background.
 */
const KEY_PREFIX = "boardImage:";

const keyOf = (id: string) => KEY_PREFIX + id;

/** Told whenever an image is saved or deleted, so anything caching it (see
    `imageUrlStore.ts`) can let go. Kept as a plain callback list so this
    module stays the lower layer and knows nothing about who is listening. */
const changeListeners = new Set<(id: string) => void>();

export function onImageChanged(listener: (id: string) => void): void {
  changeListeners.add(listener);
}

function notifyChanged(id: string): void {
  changeListeners.forEach((listener) => listener(id));
}

/** Rejects if the image could not be stored. */
export async function saveImage(id: ImageId, blob: Blob): Promise<void> {
  await idbSet(keyOf(id), blob);
  // A board may have been showing "missing" for this id (say, before a backup
  // was restored); let it look again.
  notifyChanged(id);
}

/** The stored picture, or `null` if it is missing or unreadable. */
export async function loadImage(id: string): Promise<Blob | null> {
  try {
    const value = await idbGet<unknown>(keyOf(id));
    return value instanceof Blob ? value : null;
  } catch {
    return null;
  }
}

export async function hasImage(id: string): Promise<boolean> {
  return (await loadImage(id)) !== null;
}

export async function deleteImage(id: string): Promise<void> {
  notifyChanged(id);
  try {
    await idbDelete(keyOf(id));
  } catch {
    // Nothing useful to do: an orphaned image only costs disk space, and the
    // next start-up sweep tries again.
  }
}

/**
 * Every image some board in `boards` points at, read from storage -- or
 * `null` when any of them cannot be read. A board that failed to load may well use an image, so
 * with one unreadable nothing is safe to call unused and callers must delete
 * nothing (the same rule as never writing over a board that failed to load).
 * Flushes first: a board left less than 400ms ago may still be waiting to save.
 */
function referencedImageIds(boards: readonly BoardSummary[]): Set<string> | null {
  flushPersist();
  const used = new Set<string>();
  for (const { id } of boards) {
    const board = loadPersistedBoard(id);
    if (!board) {
      return null;
    }
    const imageId = imageIdOf(board.background);
    if (imageId !== undefined) {
      used.add(imageId);
    }
  }
  return used;
}

/**
 * Deletes an image once none of `remainingBoards` uses it. Duplicated boards
 * share one image, so deleting a board must not delete a picture its copy
 * still shows. The list is passed in rather than read from storage because
 * the registry there is saved on a delay and may still name the board that
 * was just deleted.
 */
export async function releaseImageIfUnused(
  id: ImageId,
  remainingBoards: readonly BoardSummary[],
): Promise<void> {
  const used = referencedImageIds(remainingBoards);
  if (used && !used.has(id)) {
    await deleteImage(id);
  }
}

/**
 * Deletes every stored image no board uses. Run once at start-up.
 *
 * This -- not an immediate delete -- is what cleans up an image that was
 * replaced or removed: undo can bring that background straight back, so
 * deleting it on the spot would break undo. At start-up the undo history is
 * empty, so anything unreferenced really is garbage.
 */
export async function sweepUnusedImages(): Promise<void> {
  try {
    const stored = (await idbKeys(KEY_PREFIX)).map((key) => key.slice(KEY_PREFIX.length));
    const registry = loadPersistedRegistry();
    const used = registry ? referencedImageIds(registry.boards) : null;
    if (!used) {
      return;
    }
    for (const id of stored) {
      if (!used.has(id)) {
        await deleteImage(id);
      }
    }
  } catch {
    // IndexedDB unavailable: there is nothing to sweep.
  }
}
