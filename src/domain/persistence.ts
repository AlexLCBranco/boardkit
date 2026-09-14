import type { BoardId, BoardState, BoardSummary } from "./types";

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
  // `trash` and `trashedLists` were both added after v1 shipped, so a board
  // saved before either has no such field on disk -- default them rather
  // than bumping the schema version over two optional, backward-compatible
  // arrays.
  const trash = Array.isArray(data.board.trash) ? data.board.trash : [];
  const trashedLists = Array.isArray(data.board.trashedLists) ? data.board.trashedLists : [];
  return { ...data.board, trash, trashedLists };
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
  const { lists, cards, listOrder, cardOrder } = board as Record<string, unknown>;
  return (
    typeof lists === "object" &&
    lists !== null &&
    typeof cards === "object" &&
    cards !== null &&
    Array.isArray(listOrder) &&
    typeof cardOrder === "object" &&
    cardOrder !== null
  );
}

/**
 * The registry: which boards exist and which one is active. Deliberately a
 * separate persisted document from any board's own content (`PersistedBoardV1`
 * above) -- it stays tiny (an id and a name per board) regardless of how many
 * cards a board holds, so listing boards in a switcher never has to load
 * their content.
 */
export const REGISTRY_SCHEMA_VERSION = 1;

export interface PersistedRegistryV1 {
  readonly version: 1;
  readonly boards: readonly BoardSummary[];
  readonly activeBoardId: BoardId;
}

export function serializeRegistry(
  boards: readonly BoardSummary[],
  activeBoardId: BoardId,
): PersistedRegistryV1 {
  return { version: REGISTRY_SCHEMA_VERSION, boards, activeBoardId };
}

export function deserializeRegistry(data: unknown): PersistedRegistryV1 | null {
  if (!isPersistedRegistryV1(data)) {
    return null;
  }
  return data;
}

function isPersistedRegistryV1(data: unknown): data is PersistedRegistryV1 {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const candidate = data as Record<string, unknown>;
  if (candidate.version !== 1 || typeof candidate.activeBoardId !== "string") {
    return false;
  }
  return (
    Array.isArray(candidate.boards) &&
    candidate.boards.every(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as Record<string, unknown>).id === "string" &&
        typeof (entry as Record<string, unknown>).name === "string",
    )
  );
}
