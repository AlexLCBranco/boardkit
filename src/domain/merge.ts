/**
 * Merging two tabs' versions of one board, or of the board list. Pure: the
 * store (`store/persistBoard.ts`, `store/persistRegistry.ts`) decides when,
 * this file decides what the result is.
 *
 * The problem: two tabs (or, on the shared site, Boardkit and Linkkit) hold
 * the same board. Each writes the whole record, so the second write would
 * erase the first's change. Every record carries `rev`, so a tab can tell
 * that someone else stored the board since it last read it. When that
 * happens it has three versions:
 *
 *  - `base`: the board as this tab last read or wrote it,
 *  - `mine`: the board as it is in this tab now,
 *  - `theirs`: the board as the other tab stored it.
 *
 * The rule (decided with the owner, see Linkkit's PROJECT.md, the shared
 * store design): take theirs, and re-apply this tab's own changes (`base` to
 * `mine`) on top, item by item. An item is a card or a list -- its own fields
 * together with where it sits (which list, what position, in the trash or
 * not) -- or the board's background. When both tabs changed the same item,
 * theirs stays and the item is named in `conflicts`, so the user can be told.
 *
 * Positions are re-applied relative to neighbours, not as indexes: a card
 * this tab moved goes right after the card it follows here, so a card the
 * other tab added to the same list keeps its own place too.
 */

import type {
  BoardState,
  BoardSummary,
  BoardId,
  Card,
  CardId,
  List,
  ListId,
  TrashEntry,
  TrashedListEntry,
} from "./types";

/** An item both tabs changed, where the other tab's version was kept. */
export interface MergeConflict {
  readonly kind: "card" | "list" | "background" | "board";
  /** The board's id, for a `board` conflict (the board list). */
  readonly id?: string;
  /** What to call it in a message: its title as the other tab has it, or as
      this tab had it when the other tab deleted it. */
  readonly title: string;
}

export interface BoardMerge {
  readonly board: BoardState;
  readonly conflicts: readonly MergeConflict[];
}

/**
 * Deep equality for saved data, where a key holding `undefined` and a
 * missing key are the same thing: the in-memory board writes `color:
 * undefined` when a colour is cleared, and the same board read back from
 * JSON has no `color` at all.
 */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => sameValue(item, b[i]));
  }
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  for (const key of Object.keys(ra)) if (!sameValue(ra[key], rb[key])) return false;
  for (const key of Object.keys(rb)) if (!(key in ra) && rb[key] !== undefined) return false;
  return true;
}

const CONTENT_KEYS = [
  "lists",
  "cards",
  "listOrder",
  "cardOrder",
  "trash",
  "trashedLists",
  "background",
  "collapsedLists",
] as const satisfies readonly (keyof BoardState)[];

/** Whether two boards hold the same content. Only the saved fields count:
    the store hands over its whole state (actions, undo history and all). */
export const sameBoard = (a: BoardState, b: BoardState): boolean =>
  CONTENT_KEYS.every((key) => sameValue(a[key], b[key]));

/**
 * Ids in `order` that are not part of the longest run they share, in order,
 * with `before`: the ones that were added or moved, as opposed to the ones
 * that merely shifted because something else moved. Lists hold at most 50
 * cards, so the quadratic table is tiny.
 */
export function movedIds<T>(before: readonly T[], order: readonly T[]): Set<T> {
  const n = before.length;
  const m = order.length;
  // lengths[i][j]: longest common run of before[i..] and order[j..].
  const lengths: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lengths[i][j] =
        before[i] === order[j] ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }
  const kept = new Set<T>();
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (before[i] === order[j]) {
      kept.add(order[j]);
      i++;
      j++;
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) i++;
    else j++;
  }
  return new Set(order.filter((id) => !kept.has(id)));
}

/** Where a card is: `list:<id>`, `trash:<list>:<time>`, `none` (in `cards`
    but placed nowhere) or `gone` (not on the board at all). */
function cardPlace(board: BoardState, cardId: CardId, listOf: Map<CardId, ListId>): string {
  if (!Object.hasOwn(board.cards, cardId)) return "gone";
  const listId = listOf.get(cardId);
  if (listId !== undefined) return `list:${listId}`;
  const entry = board.trash.find((e) => e.cardId === cardId);
  return entry ? `trash:${entry.listId}:${entry.deletedAt}` : "none";
}

/** Where a list is: `board`, `trash:<time>`, `none` or `gone`. */
function listPlace(board: BoardState, listId: ListId): string {
  if (!Object.hasOwn(board.lists, listId)) return "gone";
  if (board.listOrder.includes(listId)) return "board";
  const entry = board.trashedLists.find((e) => e.listId === listId);
  return entry ? `trash:${entry.deletedAt}` : "none";
}

function cardLists(board: BoardState): Map<CardId, ListId> {
  const listOf = new Map<CardId, ListId>();
  for (const listId of Object.keys(board.cardOrder) as ListId[]) {
    for (const cardId of board.cardOrder[listId]) listOf.set(cardId, listId);
  }
  return listOf;
}

/** Everything one side changed since `base`, item by item. */
interface Changes {
  readonly cards: Set<CardId>;
  readonly lists: Set<ListId>;
  readonly background: boolean;
}

function changesOf(base: BoardState, side: BoardState): Changes {
  const baseLists = cardLists(base);
  const sideLists = cardLists(side);

  const cards = new Set<CardId>();
  for (const listId of Object.keys(side.cardOrder) as ListId[]) {
    for (const cardId of movedIds(base.cardOrder[listId] ?? [], side.cardOrder[listId])) cards.add(cardId);
  }
  for (const cardId of idsOf(base.cards, side.cards)) {
    if (
      !sameValue(base.cards[cardId], side.cards[cardId]) ||
      cardPlace(base, cardId, baseLists) !== cardPlace(side, cardId, sideLists)
    ) {
      cards.add(cardId);
    }
  }

  const lists = movedIds(base.listOrder, side.listOrder);
  for (const listId of idsOf(base.lists, side.lists)) {
    if (!sameValue(base.lists[listId], side.lists[listId]) || listPlace(base, listId) !== listPlace(side, listId)) {
      lists.add(listId);
    }
  }

  return { cards, lists, background: !sameValue(base.background, side.background) };
}

function idsOf<K extends string>(...records: Readonly<Record<K, unknown>>[]): Set<K> {
  const ids = new Set<K>();
  for (const record of records) for (const id of Object.keys(record) as K[]) ids.add(id);
  return ids;
}

/** Inserts `id` into `order` right after `after`, or first when `after` is
    `null` or not in it. */
function insertAfter<T>(order: T[], id: T, after: T | null): void {
  const index = after === null ? -1 : order.indexOf(after);
  order.splice(index + 1, 0, id);
}

/** The item before `id` in `mineOrder` that is also in `resultOrder`: where
    `id` goes, so it lands next to the same neighbour it has in this tab. */
function anchorOf<T>(mineOrder: readonly T[], id: T, resultOrder: readonly T[]): T | null {
  for (let i = mineOrder.indexOf(id) - 1; i >= 0; i--) {
    if (resultOrder.includes(mineOrder[i])) return mineOrder[i];
  }
  return null;
}

const titleOf = (item: { readonly title: string } | undefined, fallback: string) =>
  item?.title.trim() || fallback;

/**
 * Theirs, with this tab's changes since `base` re-applied wherever the other
 * tab left that item alone. See the file comment.
 */
export function mergeBoards(base: BoardState, mine: BoardState, theirs: BoardState): BoardMerge {
  if (sameBoard(base, mine)) return { board: theirs, conflicts: [] };
  if (sameBoard(base, theirs) || sameBoard(mine, theirs)) return { board: mine, conflicts: [] };

  const myChanges = changesOf(base, mine);
  const theirChanges = changesOf(base, theirs);
  const mineLists = cardLists(mine);
  const theirLists = cardLists(theirs);
  const conflicts: MergeConflict[] = [];

  const lists: Record<ListId, List> = { ...theirs.lists };
  const cards: Record<CardId, Card> = { ...theirs.cards };
  const cardOrder: Record<ListId, CardId[]> = {};
  for (const listId of Object.keys(theirs.cardOrder) as ListId[]) {
    cardOrder[listId] = [...theirs.cardOrder[listId]];
  }
  let listOrder: ListId[] = [...theirs.listOrder];
  let trashedLists: TrashedListEntry[] = [...theirs.trashedLists];
  let trash: TrashEntry[] = [...theirs.trash];

  // Lists first, so the cards below can be placed into lists this tab made.
  const takeLists = new Set<ListId>();
  for (const listId of myChanges.lists) {
    if (!theirChanges.lists.has(listId)) takeLists.add(listId);
    else if (
      !sameValue(mine.lists[listId], theirs.lists[listId]) ||
      listPlace(mine, listId) !== listPlace(theirs, listId)
    ) {
      conflicts.push({ kind: "list", title: titleOf(theirs.lists[listId] ?? mine.lists[listId], "A list") });
    }
  }
  listOrder = listOrder.filter((id) => !takeLists.has(id));
  trashedLists = trashedLists.filter((entry) => !takeLists.has(entry.listId));
  const erasedLists = new Set<ListId>();
  for (const listId of takeLists) {
    if (!Object.hasOwn(mine.lists, listId)) {
      // Erased here. Settled after the cards: the other tab may have put a
      // card in it that has to stay.
      erasedLists.add(listId);
      continue;
    }
    lists[listId] = mine.lists[listId];
    cardOrder[listId] ??= [];
    const trashed = mine.trashedLists.find((entry) => entry.listId === listId);
    if (trashed) trashedLists.push(trashed);
  }
  for (const listId of mine.listOrder) {
    if (takeLists.has(listId)) insertAfter(listOrder, listId, anchorOf(mine.listOrder, listId, listOrder));
  }

  // Cards.
  const takeCards = new Set<CardId>();
  for (const cardId of myChanges.cards) {
    const mineList = mineLists.get(cardId);
    if (theirChanges.cards.has(cardId)) {
      if (
        !sameValue(mine.cards[cardId], theirs.cards[cardId]) ||
        cardPlace(mine, cardId, mineLists) !== cardPlace(theirs, cardId, theirLists)
      ) {
        conflicts.push({ kind: "card", title: titleOf(theirs.cards[cardId] ?? mine.cards[cardId], "A card") });
      }
    } else if (mineList !== undefined && (!cardOrder[mineList] || erasedLists.has(mineList))) {
      // Its list here is one the other tab erased: theirs stays.
      conflicts.push({ kind: "card", title: titleOf(mine.cards[cardId], "A card") });
    } else {
      takeCards.add(cardId);
    }
  }
  for (const listId of Object.keys(cardOrder) as ListId[]) {
    cardOrder[listId] = cardOrder[listId].filter((id) => !takeCards.has(id));
  }
  trash = trash.filter((entry) => !takeCards.has(entry.cardId));
  for (const cardId of takeCards) {
    if (Object.hasOwn(mine.cards, cardId)) cards[cardId] = mine.cards[cardId];
    else delete cards[cardId];
  }
  for (const listId of Object.keys(mine.cardOrder) as ListId[]) {
    const order = mine.cardOrder[listId];
    for (const cardId of order) {
      if (takeCards.has(cardId)) insertAfter(cardOrder[listId], cardId, anchorOf(order, cardId, cardOrder[listId]));
    }
  }
  for (const entry of mine.trash) {
    if (takeCards.has(entry.cardId)) trash.push(entry);
  }

  // Lists erased here go, unless a card still sits in one (the other tab
  // added or changed it): then theirs stays.
  for (const listId of erasedLists) {
    if (cardOrder[listId] && cardOrder[listId].length > 0) {
      conflicts.push({ kind: "list", title: titleOf(theirs.lists[listId], "A list") });
      if (theirs.listOrder.includes(listId)) {
        insertAfter(listOrder, listId, anchorOf(theirs.listOrder, listId, listOrder));
      } else {
        const trashed = theirs.trashedLists.find((entry) => entry.listId === listId);
        if (trashed) trashedLists.push(trashed);
      }
      continue;
    }
    delete lists[listId];
    delete cardOrder[listId];
  }

  let background = theirs.background;
  if (myChanges.background) {
    if (!theirChanges.background) background = mine.background;
    else if (!sameValue(mine.background, theirs.background)) {
      conflicts.push({ kind: "background", title: "The background" });
    }
  }

  return {
    board: {
      lists,
      cards,
      listOrder,
      cardOrder,
      trash,
      trashedLists,
      background,
      collapsedLists: mergeCollapsed(base, mine, theirs, lists),
    },
    conflicts,
  };
}

/** Folded lists are a view setting: each list's flag is merged on its own,
    this tab's change winning, and never named as a conflict. */
function mergeCollapsed(
  base: BoardState,
  mine: BoardState,
  theirs: BoardState,
  lists: Readonly<Record<ListId, List>>,
): BoardState["collapsedLists"] {
  const result: Record<ListId, true> = {};
  for (const listId of Object.keys(lists) as ListId[]) {
    const mineFlag = mine.collapsedLists?.[listId];
    const flag = mineFlag !== base.collapsedLists?.[listId] ? mineFlag : theirs.collapsedLists?.[listId];
    if (flag) result[listId] = true;
  }
  return Object.keys(result).length > 0 || theirs.collapsedLists ? result : undefined;
}

/**
 * `next`, but reusing `previous`'s objects wherever they hold the same
 * content -- the whole board, a slice, or one card. A board read back from
 * storage is all new objects; applied as it is, every card on screen would
 * re-render for a change to one of them. With this, only what really
 * changed has a new reference, so narrow subscriptions stay narrow.
 */
export function shareUnchanged(previous: BoardState, next: BoardState): BoardState {
  const shared: BoardState = {
    lists: shareRecord(previous.lists, next.lists),
    cards: shareRecord(previous.cards, next.cards),
    listOrder: sameValue(previous.listOrder, next.listOrder) ? previous.listOrder : next.listOrder,
    cardOrder: shareRecord(previous.cardOrder, next.cardOrder),
    trash: sameValue(previous.trash, next.trash) ? previous.trash : next.trash,
    trashedLists: sameValue(previous.trashedLists, next.trashedLists) ? previous.trashedLists : next.trashedLists,
    background: sameValue(previous.background, next.background) ? previous.background : next.background,
    collapsedLists: sameValue(previous.collapsedLists, next.collapsedLists)
      ? previous.collapsedLists
      : next.collapsedLists,
  };
  return sameBoard(previous, shared) ? previous : shared;
}

function shareRecord<K extends string, V>(
  previous: Readonly<Record<K, V>>,
  next: Readonly<Record<K, V>>,
): Readonly<Record<K, V>> {
  if (sameValue(previous, next)) return previous;
  const shared = {} as Record<K, V>;
  for (const key of Object.keys(next) as K[]) {
    shared[key] = Object.hasOwn(previous, key) && sameValue(previous[key], next[key]) ? previous[key] : next[key];
  }
  return shared;
}

/** The board list after merging, and what to tell the user. */
export interface BoardListMerge {
  readonly boards: readonly BoardSummary[];
  readonly conflicts: readonly MergeConflict[];
}

/**
 * The same rule for the board list (`boardkit:registry`): theirs, with this
 * tab's new, renamed and deleted boards re-applied. A board renamed in both
 * tabs, or renamed here and deleted there, keeps theirs.
 */
export function mergeBoardLists(
  base: readonly BoardSummary[],
  mine: readonly BoardSummary[],
  theirs: readonly BoardSummary[],
): BoardListMerge {
  const byId = (list: readonly BoardSummary[]) => new Map(list.map((board) => [board.id, board]));
  const baseById = byId(base);
  const mineById = byId(mine);
  const theirsById = byId(theirs);
  const conflicts: MergeConflict[] = [];
  const result = [...theirs];

  for (const id of new Set<BoardId>([...baseById.keys(), ...mineById.keys()])) {
    const before = baseById.get(id);
    const mineBoard = mineById.get(id);
    const theirBoard = theirsById.get(id);
    if (sameValue(before, mineBoard)) continue;
    if (!sameValue(before, theirBoard)) {
      if (!sameValue(mineBoard, theirBoard)) {
        conflicts.push({ kind: "board", id, title: (theirBoard ?? mineBoard ?? before)?.name || "A board" });
      }
      continue;
    }
    const index = result.findIndex((board) => board.id === id);
    if (mineBoard === undefined) result.splice(index, 1);
    else if (index !== -1) result[index] = mineBoard;
    else {
      const anchor = anchorOf(mine.map((board) => board.id), id, result.map((board) => board.id));
      const at = anchor === null ? 0 : result.findIndex((board) => board.id === anchor) + 1;
      result.splice(at, 0, mineBoard);
    }
  }
  return { boards: result, conflicts };
}
