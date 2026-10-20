import type { BoardId } from "../domain/types";

/**
 * Finds the Linkkit map linked to a board, so deleting the board can say so.
 *
 * Read only: Linkkit's keys are written by Linkkit alone. Boardkit relies on
 * just enough of their shape to answer one question, and anything it doesn't
 * recognise (no Linkkit here, a damaged record, a newer format) reads as "no
 * linked map", which leaves the delete question as it always was.
 *
 *   linkkit:registry     { version: 1, maps: [{ id, name }] }  Linkkit's map list
 *   linkkit:trash:maps   { version: 1, maps: [{ id, name }] }  its deleted maps,
 *                        whose records stay saved until erased
 *   linkkit:map:<id>     a linked map is { version: 2, map: { name, linkedBoard } }
 *
 * A linked map is named after its board, and renaming the board here renames
 * it only in Boardkit's list (`boardkit:registry`): Linkkit's record keeps
 * the old name until the map is next edited there. So the name given is the
 * board's, from that list, as Linkkit shows it; Linkkit's only when the list
 * has none.
 *
 * A deleted map is still found: restored in Linkkit, it would come back as an
 * ordinary tree, and the question should say that before it happens.
 */

const REGISTRY_KEY = "linkkit:registry";
const MAP_TRASH_KEY = "linkkit:trash:maps";
const MAP_KEY_PREFIX = "linkkit:map:";
const LINKED_MAP_VERSION = 2;
const BOARD_LIST_KEY = "boardkit:registry";

export interface LinkedMap {
  readonly name: string;
  /** In Linkkit's trash rather than its map list. */
  readonly inTrash: boolean;
}

type Read = (key: string) => string | null;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function parse(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** The `{ id, name }` entries of Linkkit's map list or its trash. */
function entriesOf(data: unknown): { id: string; name: string }[] {
  if (!isObject(data) || data.version !== 1 || !Array.isArray(data.maps)) return [];
  return data.maps.flatMap((entry: unknown) =>
    isObject(entry) && typeof entry.id === "string" && entry.id
      ? [{ id: entry.id, name: typeof entry.name === "string" ? entry.name : "" }]
      : [],
  );
}

/** The map's name when its record links it to `boardId`, else `null`. */
function linkedName(data: unknown, boardId: BoardId): string | null {
  if (!isObject(data) || data.version !== LINKED_MAP_VERSION || !isObject(data.map)) return null;
  if (data.map.linkedBoard !== boardId) return null;
  return typeof data.map.name === "string" ? data.map.name : "";
}

/** The board's name in Boardkit's list, or "" when it has none. */
function boardName(data: unknown, boardId: BoardId): string {
  if (!isObject(data) || !Array.isArray(data.boards)) return "";
  const entry: unknown = data.boards.find((b: unknown) => isObject(b) && b.id === boardId);
  return isObject(entry) && typeof entry.name === "string" ? entry.name.trim() : "";
}

export function findLinkedMap(boardId: BoardId, read: Read = (key) => localStorage.getItem(key)): LinkedMap | null {
  try {
    const sources = [
      { entries: entriesOf(parse(read(REGISTRY_KEY))), inTrash: false },
      { entries: entriesOf(parse(read(MAP_TRASH_KEY))), inTrash: true },
    ];
    for (const { entries, inTrash } of sources) {
      for (const entry of entries) {
        const name = linkedName(parse(read(MAP_KEY_PREFIX + entry.id)), boardId);
        if (name === null) continue;
        // The board's name now, else the record's own, else Linkkit's list's.
        const board = boardName(parse(read(BOARD_LIST_KEY)), boardId);
        return { name: board || name.trim() || entry.name.trim() || "Untitled map", inTrash };
      }
    }
  } catch {
    // Storage that can't be read at all: no link to name.
  }
  return null;
}
