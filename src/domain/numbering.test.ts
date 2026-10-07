import { describe, expect, it } from "vitest";

import { numberCards, numberingOffset } from "./numbering";
import type { Card, CardId, List, ListId } from "./types";

const card = (id: string, kind?: Card["kind"]): Card => ({ id: id as CardId, title: id, kind });
const cards: Record<CardId, Card> = Object.fromEntries(
  [card("a"), card("b"), card("div", "divider"), card("c"), card("note", "note"), card("d"), card("e")].map((x) => [x.id, x]),
);
const ids = (...names: string[]) => names as CardId[];
const [l1, l2, l3] = ["l1", "l2", "l3"] as ListId[];
const lists = (continues: Partial<Record<ListId, boolean>>): Record<ListId, List> => ({
  [l1]: { id: l1, title: "1", continuesNumbering: continues[l1] },
  [l2]: { id: l2, title: "2", continuesNumbering: continues[l2] },
  [l3]: { id: l3, title: "3", continuesNumbering: continues[l3] },
});
const cardOrder = { [l1]: ids("a", "div", "b"), [l2]: ids("c", "note"), [l3]: ids("d", "e") };

describe("numberCards", () => {
  it("numbers from the offset, skipping dividers and notes without using a number", () => {
    expect(numberCards(ids("a", "div", "b", "note", "c"), cards, 0)).toEqual([1, null, 2, null, 3]);
    expect(numberCards(ids("d", "e"), cards, 5)).toEqual([6, 7]);
    expect(numberCards([], cards, 3)).toEqual([]);
  });
});

describe("numberingOffset", () => {
  const offset = (continues: Partial<Record<ListId, boolean>>, listId: ListId, order = [l1, l2, l3]) =>
    numberingOffset(order, lists(continues), cardOrder, cards, listId);

  it("is 0 for a list that starts from 1", () => {
    expect(offset({}, l2)).toBe(0);
  });

  it("continues from the list to its left, counting only numbered cards", () => {
    expect(offset({ [l2]: true }, l2)).toBe(2);
  });

  it("chains through lists that continue", () => {
    expect(offset({ [l2]: true, [l3]: true }, l3)).toBe(3);
    // The chain stops at a list that starts from 1.
    expect(offset({ [l3]: true }, l3)).toBe(1);
  });

  it("follows board order, not which list it was set up beside", () => {
    expect(offset({ [l3]: true }, l3, [l3, l1, l2])).toBe(0);
    expect(offset({ [l2]: true }, l2, [l3, l2, l1])).toBe(2);
  });

  it("is 0 for a list not on the board", () => {
    expect(offset({ [l2]: true }, "trashed" as ListId)).toBe(0);
  });
});
