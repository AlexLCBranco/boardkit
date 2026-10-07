import { createListId } from "./ids";
import { MAX_CARDS_PER_LIST } from "./limits";
import {
  ICON_KEYS,
  ITEM_STATUSES,
  NUMBER_EMPHASES,
  NUMBER_FORMATS,
  type BoardState,
  type Card,
  type CardId,
  type List,
  type ListId,
  type TrashEntry,
  type TrashedListEntry,
} from "./types";

/**
 * Rebuilds a board from saved data that may be damaged -- a half-written
 * save, a hand-edited file, a bug in an older version -- keeping everything
 * that can still be read. Pure: `persistence.ts` calls it on every load, and
 * a healthy board comes back unchanged with an all-zero report.
 *
 * The rule is *repair, don't reject*: an id pointing at nothing is dropped,
 * a list with no card order gets an empty one, and a card or list that
 * nothing points at any more is put back on the board rather than lost.
 * Only an entry that is not even an object is gone for good.
 *
 * Two kinds of fix are deliberately kept apart. Structural damage (the
 * counts in `RepairReport`) means the file is not what the app wrote, and
 * the user is told. An optional field this build doesn't understand -- an
 * icon from a newer version, say -- is dropped silently, as `colors.ts` and
 * friends already do for colours: that is forward compatibility, not damage.
 */

export interface RepairReport {
  /** Entries that could not be read at all, and are not on the repaired
      board. A whole missing container (no `lists` at all) counts as one. */
  readonly lost: number;
  /** Everything else that was wrong and has been fixed: ids pointing at
      nothing, duplicates, missing orders, cards or lists put back. */
  readonly fixed: number;
}

/** What the "Recovered cards" list is called, for cards found on the board
    that no list or trash entry pointed at any more. */
export const RECOVERED_LIST_TITLE = "Recovered cards";

type Raw = Record<string, unknown>;

const isRecord = (value: unknown): value is Raw =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Keys from parsed JSON become keys of plain objects below; `__proto__`
    would set the object's prototype instead of adding an entry. */
const isSafeKey = (key: string) => key !== "__proto__";

export function repairBoard(raw: Raw): { board: BoardState; report: RepairReport } {
  let lost = 0;
  let fixed = 0;
  const fix = () => {
    fixed += 1;
  };

  // Entities first: every later step checks references against these.
  const lists: Record<ListId, List> = {};
  const cards: Record<CardId, Card> = {};
  for (const [container, target, rebuild] of [
    [raw.lists, lists, repairList],
    [raw.cards, cards, repairCard],
  ] as const) {
    if (!isRecord(container)) {
      lost += 1;
      continue;
    }
    for (const [key, value] of Object.entries(container)) {
      if (isSafeKey(key) && isRecord(value)) {
        (target as Record<string, unknown>)[key] = rebuild(key, value, fix);
      } else {
        lost += 1;
      }
    }
  }
  const hasList = (id: unknown): id is ListId => typeof id === "string" && Object.hasOwn(lists, id);
  const hasCard = (id: unknown): id is CardId => typeof id === "string" && Object.hasOwn(cards, id);

  // Columns: the saved order, minus ids that point at nothing or repeat.
  const listOrder: ListId[] = [];
  for (const id of arrayOr(raw.listOrder, fix)) {
    if (hasList(id) && !listOrder.includes(id)) listOrder.push(id);
    else fix();
  }

  const trashedLists: TrashedListEntry[] = [];
  for (const entry of arrayOr(raw.trashedLists, () => {})) {
    if (
      isRecord(entry) &&
      hasList(entry.listId) &&
      !listOrder.includes(entry.listId) &&
      !trashedLists.some((kept) => kept.listId === entry.listId)
    ) {
      trashedLists.push({ listId: entry.listId, deletedAt: timeOr(entry.deletedAt, fix) });
    } else {
      fix();
    }
  }

  // A list neither shown nor in the trash is unreachable: show it again.
  for (const id of Object.keys(lists) as ListId[]) {
    if (!listOrder.includes(id) && !trashedLists.some((entry) => entry.listId === id)) {
      listOrder.push(id);
      fix();
    }
  }

  // Cards: each list's saved order, keeping a card only the first time it
  // appears anywhere, so no card can end up in two lists at once.
  const placed = new Set<CardId>();
  const rawCardOrder = isRecord(raw.cardOrder) ? raw.cardOrder : (fix(), {});
  const cardOrder: Record<ListId, CardId[]> = {};
  for (const listId of Object.keys(lists) as ListId[]) {
    cardOrder[listId] = [];
    for (const id of arrayOr(rawCardOrder[listId], fix)) {
      if (hasCard(id) && !placed.has(id)) {
        cardOrder[listId].push(id);
        placed.add(id);
      } else {
        fix();
      }
    }
  }

  const trash: TrashEntry[] = [];
  for (const entry of arrayOr(raw.trash, () => {})) {
    if (isRecord(entry) && hasCard(entry.cardId) && !placed.has(entry.cardId) && typeof entry.listId === "string") {
      trash.push({ cardId: entry.cardId, listId: entry.listId as ListId, deletedAt: timeOr(entry.deletedAt, fix) });
      placed.add(entry.cardId);
    } else {
      fix();
    }
  }

  // A card no list or trash entry points at would be invisible for ever.
  // Put them back, in new lists at the end, within the per-list limit.
  const orphans = (Object.keys(cards) as CardId[]).filter((id) => !placed.has(id));
  for (let start = 0; start < orphans.length; start += MAX_CARDS_PER_LIST) {
    const id = createListId();
    lists[id] = { id, title: RECOVERED_LIST_TITLE };
    listOrder.push(id);
    cardOrder[id] = orphans.slice(start, start + MAX_CARDS_PER_LIST);
  }
  fixed += orphans.length;

  return {
    board: {
      lists,
      cards,
      listOrder,
      cardOrder,
      trash,
      trashedLists,
      background: raw.background as BoardState["background"],
      collapsedLists: raw.collapsedLists as BoardState["collapsedLists"],
    },
    report: { lost, fixed },
  };
}

function arrayOr(value: unknown, onMissing: () => void): readonly unknown[] {
  if (Array.isArray(value)) return value;
  onMissing();
  return [];
}

function timeOr(value: unknown, onBad: () => void): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  onBad();
  return 0;
}

/** The fields every list and card needs: an id matching its key (the key is
    what everything else refers to) and a title. Anything else on the entry is
    kept as it is. */
function withIdAndTitle(key: string, value: Raw, fix: () => void): Raw {
  let entry = value;
  if (entry.id !== key) {
    entry = { ...entry, id: key };
    fix();
  }
  if (typeof entry.title !== "string") {
    entry = { ...entry, title: "" };
    fix();
  }
  return entry;
}

/** Drops each named optional field whose value fails its check. Silent: see
    the file comment. */
function withoutBadOptionals(entry: Raw, checks: Record<string, (value: unknown) => boolean>): Raw {
  const bad = Object.keys(checks).filter((field) => entry[field] !== undefined && !checks[field](entry[field]));
  if (bad.length === 0) return entry;
  const cleaned = { ...entry };
  for (const field of bad) delete cleaned[field];
  return cleaned;
}

const oneOf = (options: readonly string[]) => (value: unknown) =>
  typeof value === "string" && options.includes(value);
const isString = (value: unknown) => typeof value === "string";
const isBoolean = (value: unknown) => typeof value === "boolean";
const isNumber = (value: unknown) => typeof value === "number" && Number.isFinite(value);

function repairList(key: string, value: Raw, fix: () => void): List {
  return withoutBadOptionals(withIdAndTitle(key, value, fix), {
    icon: oneOf(ICON_KEYS),
    width: isNumber,
    continuesNumbering: isBoolean,
    numberFormat: oneOf(NUMBER_FORMATS),
    numbersHidden: isBoolean,
    status: oneOf(ITEM_STATUSES),
  }) as unknown as List;
}

function repairCard(key: string, value: Raw, fix: () => void): Card {
  return withoutBadOptionals(withIdAndTitle(key, value, fix), {
    description: isString,
    postgameDescription: isString,
    numberEmphasis: oneOf(NUMBER_EMPHASES),
    status: oneOf(ITEM_STATUSES),
  }) as unknown as Card;
}
