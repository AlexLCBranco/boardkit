import { describe, expect, it } from "vitest";

import { insertAt, moveBetweenLists, moveList, moveWithinList } from "./ordering";
import type { CardId, ListId } from "./types";

const [a, b, c, d] = ["a", "b", "c", "d"] as CardId[];
const [todo, done] = ["todo", "done"] as ListId[];

describe("moveWithinList", () => {
  it("moves a card to the place of the card it is dropped on, both ways", () => {
    expect(moveWithinList([a, b, c, d], a, c)).toEqual([b, c, a, d]);
    expect(moveWithinList([a, b, c, d], d, b)).toEqual([a, d, b, c]);
  });

  it("returns the same array for a no-op, so nothing re-renders", () => {
    const order = [a, b, c];
    expect(moveWithinList(order, b, b)).toBe(order);
    expect(moveWithinList(order, a, d)).toBe(order);
    expect(moveWithinList(order, d, a)).toBe(order);
  });
});

describe("insertAt", () => {
  it("inserts at the index, clamped to the ends", () => {
    expect(insertAt([a, b], c, 1)).toEqual([a, c, b]);
    expect(insertAt([a, b], c, -5)).toEqual([c, a, b]);
    expect(insertAt([a, b], c, 99)).toEqual([a, b, c]);
    expect(insertAt([], c, 0)).toEqual([c]);
  });
});

describe("moveBetweenLists", () => {
  const order = { [todo]: [a, b], [done]: [c, d] };

  it("lands before the card it is over, or at the end", () => {
    expect(moveBetweenLists(order, a, todo, done, d)).toEqual({ [todo]: [b], [done]: [c, a, d] });
    expect(moveBetweenLists(order, a, todo, done, null)).toEqual({ [todo]: [b], [done]: [c, d, a] });
  });

  it("goes to the end when the card it was over has left", () => {
    expect(moveBetweenLists(order, a, todo, done, "gone" as CardId)[done]).toEqual([c, d, a]);
  });

  it("leaves other lists' arrays alone", () => {
    const other = "other" as ListId;
    const withOther = { ...order, [other]: [] };
    expect(moveBetweenLists(withOther, a, todo, done, null)[other]).toBe(withOther[other]);
  });

  it("never puts a card in a list twice, even with a stale source list", () => {
    // The card already moved to `done`; a late drag-over still says `todo`.
    const moved = moveBetweenLists(order, a, todo, done, null);
    const again = moveBetweenLists(moved, a, todo, done, c);
    expect(again[done]).toEqual([a, c, d]);
    expect(again[todo]).toEqual([b]);
  });
});

describe("moveList", () => {
  it("moves a list to the place of the list it is dropped on", () => {
    const lists = ["l1", "l2", "l3"] as ListId[];
    expect(moveList(lists, lists[0], lists[2])).toEqual(["l2", "l3", "l1"]);
    expect(moveList(lists, lists[1], lists[1])).toBe(lists);
  });
});
