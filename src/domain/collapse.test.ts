import { describe, expect, it } from "vitest";

import { isCollapsed, knownCollapsed, listOfCard, withCollapsed } from "./collapse";
import { deserializeBoard, serializeBoard } from "./persistence";
import { createBoard } from "./seed";
import type { CardId, ListId } from "./types";

const a = "a" as ListId;
const b = "b" as ListId;

describe("withCollapsed", () => {
  it("adds and removes a list, storing expanded as absent", () => {
    const one = withCollapsed(undefined, a, true);
    expect(one).toEqual({ a: true });
    expect(withCollapsed(one, a, false)).toBeUndefined();
  });

  it("returns the same object when nothing changes", () => {
    const one = withCollapsed(undefined, a, true);
    expect(withCollapsed(one, a, true)).toBe(one);
    expect(withCollapsed(one, b, false)).toBe(one);
  });
});

describe("knownCollapsed", () => {
  it("keeps only true flags for lists that exist", () => {
    const lists = { [a]: { id: a, title: "A" } };
    expect(knownCollapsed({ a: true, b: true, c: "yes" }, lists)).toEqual({ a: true });
    expect(knownCollapsed("nonsense", lists)).toBeUndefined();
  });
});

describe("listOfCard", () => {
  it("finds the list holding a card", () => {
    const cardOrder = { [a]: ["x" as CardId], [b]: ["y" as CardId] };
    expect(listOfCard(cardOrder, "y" as CardId)).toBe(b);
    expect(listOfCard(cardOrder, "z" as CardId)).toBeUndefined();
  });
});

describe("persistence", () => {
  it("round-trips collapsed lists with the board", () => {
    const board = createBoard([{ title: "Done", cards: ["one"] }]);
    const listId = board.listOrder[0];
    const saved = { ...board, collapsedLists: withCollapsed(undefined, listId, true) };
    const loaded = deserializeBoard(JSON.parse(JSON.stringify(serializeBoard(saved))));
    expect(isCollapsed(loaded?.collapsedLists, listId)).toBe(true);
  });
});
