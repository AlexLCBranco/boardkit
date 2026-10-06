import { describe, expect, it } from "vitest";

import {
  LIST_TRASH_LIMIT,
  TRASH_LIMIT,
  cardTrashOverflow,
  listTrashOverflow,
  moveCardToTrash,
  moveListToTrash,
} from "./trash";
import type { BoardState, CardId, ListId, TrashEntry, TrashedListEntry } from "./types";

const keep = "keep" as ListId;

/** A board with one list on it, `keep`, holding `cardCount` cards, plus
    `trashed` cards already in the card trash and `trashedLists` lists (each
    with two cards) in the list trash. */
function board({ cardCount = 1, trashed = 0, trashedLists = 0 } = {}): BoardState {
  const cards: Record<CardId, { id: CardId; title: string }> = {};
  const lists: Record<ListId, { id: ListId; title: string }> = { [keep]: { id: keep, title: "Keep" } };
  const cardOrder: Record<ListId, CardId[]> = { [keep]: [] };
  const trash: TrashEntry[] = [];
  const lostLists: TrashedListEntry[] = [];

  for (let i = 0; i < cardCount; i++) {
    const id = `c${i}` as CardId;
    cards[id] = { id, title: `Card ${i}` };
    cardOrder[keep].push(id);
  }
  for (let i = 0; i < trashed; i++) {
    const id = `t${i}` as CardId;
    cards[id] = { id, title: `Trashed ${i}` };
    trash.push({ cardId: id, listId: keep, deletedAt: i });
  }
  for (let i = 0; i < trashedLists; i++) {
    const listId = `l${i}` as ListId;
    lists[listId] = { id: listId, title: `List ${i}` };
    cardOrder[listId] = [`l${i}a`, `l${i}b`] as CardId[];
    for (const id of cardOrder[listId]) cards[id] = { id, title: id };
    lostLists.push({ listId, deletedAt: i });
  }

  return { lists, cards, listOrder: [keep], cardOrder, trash, trashedLists: lostLists };
}

describe("cardTrashOverflow", () => {
  it("is null while the trash has room", () => {
    expect(cardTrashOverflow(board({ trashed: 0 }))).toBeNull();
    expect(cardTrashOverflow(board({ trashed: TRASH_LIMIT - 1 }))).toBeNull();
  });

  it("names the oldest card once the trash is full", () => {
    expect(cardTrashOverflow(board({ trashed: TRASH_LIMIT }))?.cardId).toBe("t0");
  });

  it("names exactly what moveCardToTrash then erases", () => {
    const state = board({ trashed: TRASH_LIMIT });
    const erased = cardTrashOverflow(state)!.cardId;
    const next = moveCardToTrash(state, keep, "c0" as CardId, 999);
    expect(next.trash).toHaveLength(TRASH_LIMIT);
    expect(next.cards[erased]).toBeUndefined();
    expect(next.cards["c0" as CardId]).toBeDefined();
  });

  it("is unaffected by trashed lists, however many cards they hold", () => {
    expect(cardTrashOverflow(board({ trashedLists: LIST_TRASH_LIMIT }))).toBeNull();
  });
});

describe("listTrashOverflow", () => {
  it("is null while the list trash has room", () => {
    expect(listTrashOverflow(board({ trashedLists: LIST_TRASH_LIMIT - 1 }))).toBeNull();
  });

  it("names the oldest list once the list trash is full", () => {
    expect(listTrashOverflow(board({ trashedLists: LIST_TRASH_LIMIT }))?.listId).toBe("l0");
  });

  it("names exactly what moveListToTrash then erases, cards included", () => {
    const state = board({ trashedLists: LIST_TRASH_LIMIT });
    const erased = listTrashOverflow(state)!.listId;
    const next = moveListToTrash(state, keep, 999);
    expect(next.trashedLists).toHaveLength(LIST_TRASH_LIMIT);
    expect(next.lists[erased]).toBeUndefined();
    expect(next.cards["l0a" as CardId]).toBeUndefined();
  });

  it("counts a trashed list once, not once per card", () => {
    const next = moveListToTrash(board({ cardCount: 40 }), keep, 1);
    expect(next.trashedLists).toHaveLength(1);
    // Its 40 cards stay in its own `cardOrder` entry: the card trash isn't
    // part of the change at all.
    expect(next.cardOrder[keep]).toHaveLength(40);
    expect(next).not.toHaveProperty("trash");
  });
});
