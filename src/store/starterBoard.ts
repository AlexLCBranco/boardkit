import type { BoardId } from "../domain/types";
import { flushPersist, persistedBoardText } from "./persistBoard";

/**
 * The board a first-ever run creates, remembered so the app can tell "a new
 * address with nothing on it yet" from "someone's only board". While that
 * starter is the only board, the start-fresh notice offers restoring from a
 * backup; once boards are restored, the starter is removed if it was never
 * changed (it is demo content) and kept if it was.
 *
 * Stored as the board's id plus its saved text at creation: unchanged text
 * means untouched, because a board is only rewritten when it changes.
 */
const STORAGE_KEY = "boardkit:starterBoard";

interface Starter {
  readonly id: BoardId;
  readonly saved: string;
}

function read(): Starter | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (typeof parsed !== "object" || parsed === null) return null;
    const { id, saved } = parsed as Record<string, unknown>;
    return typeof id === "string" && typeof saved === "string" ? { id: id as BoardId, saved } : null;
  } catch {
    return null;
  }
}

/** Called once, right after a first-ever run has saved its board. */
export function rememberStarterBoard(boardId: BoardId): void {
  const saved = persistedBoardText(boardId);
  if (saved === null) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: boardId, saved }));
  } catch {
    // Without it the app simply never offers the start-fresh restore.
  }
}

export function starterBoardId(): BoardId | null {
  return read()?.id ?? null;
}

/** True while the starter's saved content is still what it was created as. */
export function isStarterUntouched(boardId: BoardId): boolean {
  const starter = read();
  if (starter?.id !== boardId) return false;
  flushPersist();
  return persistedBoardText(boardId) === starter.saved;
}

/** "Not now", or boards were restored: stop offering. */
export function forgetStarterBoard(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Harmless: the notice also hides once there is more than one board.
  }
}
