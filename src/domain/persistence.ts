import { knownBackground } from "./background";
import { knownCollapsed } from "./collapse";
import { withKnownKinds } from "./cardKinds";
import { withKnownColors } from "./colors";
import { withKnownHighlights } from "./highlight";
import { repairBoard, type RepairReport } from "./repair";
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
export const SCHEMA_VERSION = 2;

/**
 * Version 2 adds `status` (keep / maybe / cut) on lists and cards, and
 * `rev`: a count raised by every write of this record, so a writer can tell
 * whether someone else (another tab, or Linkkit, which will read and write
 * this same record on the shared site) stored it since it last read it. A
 * version 1 record reads as version 2 with `rev` 0 and no statuses: nothing
 * else changed, so there is nothing to migrate.
 */
export interface PersistedBoardV2 {
  readonly version: 2;
  readonly rev: number;
  readonly board: BoardState;
}

/**
 * Copies out exactly the content fields. Callers pass the whole store state
 * (which also carries `boardId`, `boards`, `history` and the actions), so
 * anything not named here would leak into storage -- and, worse, be spread
 * back over the live store on load, e.g. an old board list overwriting the
 * current one when switching boards.
 *
 * `background` and `collapsedLists` are always present as keys, even when it is `undefined`: a
 * loaded board is spread over the live store, and a key that is merely
 * missing would leave the *previous* board's background showing.
 * `JSON.stringify` drops an undefined value, so nothing extra is saved.
 */
export function boardContent(board: BoardState): BoardState {
  const { lists, cards, listOrder, cardOrder, trash, trashedLists, background, collapsedLists } =
    board;
  return { lists, cards, listOrder, cardOrder, trash, trashedLists, background, collapsedLists };
}

export function serializeBoard(board: BoardState, rev = 0): PersistedBoardV2 {
  return { version: SCHEMA_VERSION, rev, board: boardContent(board) };
}

/** A stored record's `rev`, or 0 when it has none (version 1) or it isn't a
    whole number of at least 0. */
export function revOf(data: unknown): number {
  const rev = isRecord(data) ? data.rev : undefined;
  return typeof rev === "number" && Number.isSafeInteger(rev) && rev >= 0 ? rev : 0;
}

/** Whether a stored record was written by a newer Boardkit: its version is
    a number above the one this build writes. Never written over. */
export function isNewerVersion(data: unknown): boolean {
  const version = isRecord(data) ? data.version : undefined;
  return typeof version === "number" && version > SCHEMA_VERSION;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * What reading a saved board found. `repaired` carries a board rebuilt from
 * damaged data (`domain/repair.ts`), and the caller decides what that means:
 * opening the board keeps the original aside and tells the user, while a
 * read of some *other* board (search, backup, a transfer) treats it like
 * `unreadable` rather than act on a partial copy.
 */
export type BoardRead =
  | { readonly status: "ok"; readonly board: BoardState }
  | { readonly status: "repaired"; readonly board: BoardState; readonly report: RepairReport }
  | { readonly status: "unreadable" }
  /** Written by a newer Boardkit. `board` is what this build can make of it,
      for showing read-only, or `null` when that is nothing. */
  | { readonly status: "newer"; readonly board: BoardState | null };

/**
 * Validates, repairs and migrates persisted data up to the current schema.
 * Version 2 only adds to version 1 (see `PersistedBoardV2`), so both go
 * through the same repair; a later shape change branches on `version` here.
 *
 * `unreadable` is reserved for data with nothing to salvage: not an object,
 * no version this build knows, or a board with no list or card left once
 * repaired.
 *
 * A version above this build's is `newer`, not `unreadable`: the board is
 * fine, this build is just too old for it. Repairing it and saving the
 * result would destroy what the newer version added, so it is only ever
 * shown read-only (`store/persistBoard.ts` never writes over it).
 */
export function readBoard(data: unknown): BoardRead {
  if (!isRecord(data)) {
    return { status: "unreadable" };
  }
  const raw = isRecord(data.board) ? data.board : null;
  if (isNewerVersion(data)) {
    const shown = raw && cleanBoard(raw).board;
    return { status: "newer", board: shown && !isEmpty(shown) ? shown : null };
  }
  if ((data.version !== 1 && data.version !== 2) || raw === null) {
    return { status: "unreadable" };
  }
  const { board, report } = cleanBoard(raw);
  if (report.lost === 0 && report.fixed === 0) {
    return { status: "ok", board };
  }
  if (isEmpty(board)) {
    return { status: "unreadable" };
  }
  return { status: "repaired", board, report };
}

const isEmpty = (board: BoardState) =>
  Object.keys(board.lists).length === 0 && Object.keys(board.cards).length === 0;

/** A saved board part repaired, minus every optional value this build can't
    read. */
function cleanBoard(raw: Record<string, unknown>): { board: BoardState; report: RepairReport } {
  // Also strips any extra fields boards saved by earlier versions carry (a
  // stale `boards` list, `boardId`, `history`) so they cannot reach the
  // store. `trash` and `trashedLists` were both added after v1 shipped, so a
  // board saved before either has no such field; the repair defaults them
  // without counting it as damage.
  const { board: repaired, report } = repairBoard(raw);
  // A card's `kind` is optional the same way, but one this build doesn't know
  // (from a newer version, or a hand-edited backup) is dropped, so the card
  // loads as a normal one instead of breaking the board.
  // Colours get the same treatment: one this build can't read is dropped, so
  // the list or card loads uncoloured instead of breaking the board.
  // Highlights too: an unreadable colour or style is dropped on its own.
  const cards = withKnownHighlights(withKnownColors(withKnownKinds(repaired.cards)));
  const lists = withKnownColors(repaired.lists);
  // A background this build can't read is dropped the same way.
  const background = knownBackground(repaired.background);
  // Collapse flags for lists that no longer exist are dropped.
  const collapsedLists = knownCollapsed(repaired.collapsedLists, lists);
  return { board: boardContent({ ...repaired, lists, cards, background, collapsedLists }), report };
}

/** The board from `readBoard`, repaired if need be, or `null` when nothing
    could be salvaged or it is a newer version's. For reads where a repaired
    copy is fine as it is: a backup being imported, the pre-multi-board key
    -- neither overwrites anything. */
export function deserializeBoard(data: unknown): BoardState | null {
  const read = readBoard(data);
  return read.status === "ok" || read.status === "repaired" ? read.board : null;
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

/** A board background image inside a backup: JSON cannot hold bytes, so the
    picture travels as base64 text (about a third larger than the file). */
export interface BackupImage {
  readonly type: string;
  readonly data: string;
}

export interface BackupFileV1 {
  readonly format: typeof BACKUP_FORMAT;
  readonly version: 1;
  readonly exportedAt: string;
  readonly boards: readonly BackupBoard[];
  /** Background images the boards refer to, by `imageId`. Absent from
      backups made before images existed, and when no board has one: that is
      why it needs no version bump. */
  readonly images?: Readonly<Record<string, BackupImage>>;
}

export function serializeBackup(
  boards: readonly BackupBoard[],
  exportedAt: string,
  images: Readonly<Record<string, BackupImage>> = {},
): BackupFileV1 {
  return {
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt,
    boards,
    ...(Object.keys(images).length > 0 ? { images } : {}),
  };
}

/**
 * The images in a backup file, or an empty record when it has none. Entries
 * that are not `{ type, data }` strings are skipped rather than failing the
 * import: a board whose image is missing falls back to the default
 * background, which is all a lost image ever costs.
 */
export function deserializeBackupImages(data: unknown): Record<string, BackupImage> {
  const images: Record<string, BackupImage> = {};
  if (typeof data !== "object" || data === null) {
    return images;
  }
  const raw = (data as Record<string, unknown>).images;
  if (typeof raw !== "object" || raw === null) {
    return images;
  }
  for (const [id, entry] of Object.entries(raw)) {
    if (typeof entry !== "object" || entry === null) continue;
    const { type, data: encoded } = entry as Record<string, unknown>;
    if (typeof type === "string" && type.startsWith("image/") && typeof encoded === "string") {
      images[id] = { type, data: encoded };
    }
  }
  return images;
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
 * separate persisted document from any board's own content (`PersistedBoardV2`
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
