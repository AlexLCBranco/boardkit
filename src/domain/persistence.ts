import type { BoardState } from "./types";

/**
 * The shape written to storage, and the migration path for it.
 *
 * A version number is written from the very first release, before there is
 * anything to migrate, because that is the only point at which adding one is
 * free. Every later shape change can then branch on `version` and chain a
 * transform onto data that already declares what it is, instead of guessing
 * at the shape of something with no tag at all.
 */
export const SCHEMA_VERSION = 1;

export interface PersistedBoardV1 {
  readonly version: 1;
  readonly board: BoardState;
}

export function serializeBoard(board: BoardState): PersistedBoardV1 {
  return { version: SCHEMA_VERSION, board };
}

/**
 * Validates and migrates persisted data up to the current schema. There is
 * only one version so far, so today this is a validation gate more than a
 * migration -- but the shape, read a version and branch on it, is what a
 * real migration chain slots into later rather than being rewritten around.
 *
 * Returns `null` for anything unreadable: missing fields, a future version
 * this build does not know about, or JSON that never parsed. The caller
 * falls back to a fresh board rather than crashing on bad storage.
 */
export function deserializeBoard(data: unknown): BoardState | null {
  if (!isPersistedBoardV1(data)) {
    return null;
  }
  return data.board;
}

function isPersistedBoardV1(data: unknown): data is PersistedBoardV1 {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const candidate = data as Record<string, unknown>;
  if (candidate.version !== 1) {
    return false;
  }
  const board = candidate.board;
  if (typeof board !== "object" || board === null) {
    return false;
  }
  const { lists, cards, listOrder, cardOrder, settings } = board as Record<string, unknown>;
  return (
    typeof lists === "object" &&
    lists !== null &&
    typeof cards === "object" &&
    cards !== null &&
    Array.isArray(listOrder) &&
    typeof cardOrder === "object" &&
    cardOrder !== null &&
    typeof settings === "object" &&
    settings !== null
  );
}
