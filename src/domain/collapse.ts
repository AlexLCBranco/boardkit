import type { BoardState, CardId, ListId } from "./types";

/**
 * Which lists are folded down to a thin strip. Pure, like `ordering.ts`.
 *
 * Collapse is how the board is being *looked at*, not what is on it, so it
 * lives in its own board-level slice rather than on each `List`. That is
 * what keeps it out of undo: history patches restore whole `lists`
 * snapshots, so a flag stored on the list would be rolled back by undoing
 * any unrelated rename or recolour. Nothing in `history` ever names this
 * slice, so no undo or redo can touch it.
 */
export type CollapsedLists = NonNullable<BoardState["collapsedLists"]>;

export function isCollapsed(collapsed: BoardState["collapsedLists"], listId: ListId): boolean {
  return collapsed?.[listId] === true;
}

/** Returns the same object when nothing changes, so subscribers bail out.
    Expanded is stored as absent, keeping the saved board small. */
export function withCollapsed(
  collapsed: BoardState["collapsedLists"],
  listId: ListId,
  value: boolean,
): BoardState["collapsedLists"] {
  if (isCollapsed(collapsed, listId) === value) {
    return collapsed;
  }
  const next: Record<ListId, true> = { ...collapsed };
  if (value) {
    next[listId] = true;
  } else {
    delete next[listId];
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

/** The list a card sits in, or `undefined` for a trashed or unknown card. */
export function listOfCard(
  cardOrder: BoardState["cardOrder"],
  cardId: CardId,
): ListId | undefined {
  return (Object.keys(cardOrder) as ListId[]).find((listId) => cardOrder[listId].includes(cardId));
}

/**
 * Cleans a stored value on load: keeps only `true` entries for lists that
 * still exist. Anything unreadable just means "nothing collapsed" -- a
 * collapse flag is never worth refusing a board over.
 */
export function knownCollapsed(
  raw: unknown,
  lists: BoardState["lists"],
): BoardState["collapsedLists"] {
  if (typeof raw !== "object" || raw === null) {
    return undefined;
  }
  const result: Record<ListId, true> = {};
  for (const [listId, value] of Object.entries(raw)) {
    if (value === true && listId in lists) {
      result[listId as ListId] = true;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}
