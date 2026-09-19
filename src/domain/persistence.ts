import { withKnownKinds } from "./cardKinds";
import { withKnownColors } from "./colors";
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

/**
 * Copies out exactly the six content fields. Callers pass the whole store
 * state (which also carries `boardId`, `boards`, `history` and the actions),
 * so anything not named here would leak into storage -- and, worse, be spread
 * back over the live store on load, e.g. an old board list overwriting the
 * current one when switching boards.
 */
function pickContent(board: BoardState): BoardState {
  const { lists, cards, listOrder, cardOrder, trash, trashedLists } = board;
  return { lists, cards, listOrder, cardOrder, trash, trashedLists };
}

export function serializeBoard(board: BoardState): PersistedBoardV1 {
  return { version: SCHEMA_VERSION, board: pickContent(board) };
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
  // Also strips any extra fields boards saved by earlier versions carry (a
  // stale `boards` list, `boardId`, `history`) so they cannot reach the store.
  // A card's `kind` is optional the same way, but one this build doesn't know
  // (from a newer version, or a hand-edited backup) is dropped, so the card
  // loads as a normal one instead of breaking the board.
  // Colours get the same treatment: one this build can't read is dropped, so
  // the list or card loads uncoloured instead of breaking the board.
  const cards = withKnownColors(withKnownKinds(data.board.cards));
  const lists = withKnownColors(data.board.lists);
  return pickContent({ ...data.board, lists, cards, trash, trashedLists });
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
 * The backup file: every board's content in one document a person can keep,
 * move between browsers, or restore after their storage is cleared. It is a
 * different document from the two above -- those are what the app keeps for
 * itself, this is what the user keeps -- so it carries a `format` tag as well
 * as a version, letting an import reject a file that is not a backup at all
 * with a clear reason rather than a shape mismatch.
 */
export const BACKUP_FORMAT = "boardkit-backup";

export interface BackupBoard {
  readonly id: BoardId;
  readonly name: string;
  readonly board: BoardState;
}

export interface BackupFileV1 {
  readonly format: typeof BACKUP_FORMAT;
  readonly version: 1;
  readonly exportedAt: string;
  readonly boards: readonly BackupBoard[];
}

export function serializeBackup(boards: readonly BackupBoard[], exportedAt: string): BackupFileV1 {
  return { format: BACKUP_FORMAT, version: 1, exportedAt, boards };
}

/**
 * Returns every board in the file, each validated by the same
 * `deserializeBoard` a normal load goes through, or `null` if the file is not
 * a backup or any board in it is unreadable. Rejecting the whole file is safe
 * here in a way it is not for a stored board: nothing is replaced by an
 * import, so a refused file costs the user nothing.
 */
export function deserializeBackup(data: unknown): BackupBoard[] | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }
  const candidate = data as Record<string, unknown>;
  if (candidate.format !== BACKUP_FORMAT || candidate.version !== 1 || !Array.isArray(candidate.boards)) {
    return null;
  }
  const boards: BackupBoard[] = [];
  for (const entry of candidate.boards as unknown[]) {
    if (typeof entry !== "object" || entry === null) {
      return null;
    }
    const { id, name, board } = entry as Record<string, unknown>;
    if (typeof id !== "string" || typeof name !== "string") {
      return null;
    }
    const validated = deserializeBoard({ version: SCHEMA_VERSION, board });
    if (!validated) {
      return null;
    }
    boards.push({ id: id as BoardId, name, board: validated });
  }
  return boards;
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
