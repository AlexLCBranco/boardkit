import { describe, expect, it } from "vitest";

import { createBoardId, createCardId, createListId } from "./ids";
import { searchBoards } from "./search";
import { nextColumnThotsMode, thotsLabel } from "./thots";
import type { BoardState, Card, List } from "./types";

describe("nextColumnThotsMode", () => {
  it("cycles hidden -> pregame -> postgame -> hidden with two thots", () => {
    expect(nextColumnThotsMode("hidden", false)).toBe("pregame");
    expect(nextColumnThotsMode("pregame", false)).toBe("postgame");
    expect(nextColumnThotsMode("postgame", false)).toBe("hidden");
  });

  it("never shows postgame with one", () => {
    expect(nextColumnThotsMode("hidden", true)).toBe("pregame");
    expect(nextColumnThotsMode("pregame", true)).toBe("hidden");
    expect(nextColumnThotsMode("postgame", true)).toBe("hidden");
  });
});

describe("thotsLabel", () => {
  it("names both slots with two, and just 'thots' with one", () => {
    expect(thotsLabel("pregame", false)).toBe("pregame thots");
    expect(thotsLabel("postgame", false)).toBe("postgame thots");
    expect(thotsLabel("pregame", true)).toBe("thots");
  });
});

describe("search in a single-thots list", () => {
  function boardWith(list: Partial<List>): BoardState {
    const listId = createListId();
    const card: Card = { id: createCardId(), title: "game", postgameDescription: "hidden words" };
    return {
      lists: { [listId]: { id: listId, title: "L", ...list } },
      cards: { [card.id]: card },
      listOrder: [listId],
      cardOrder: { [listId]: [card.id] },
      trash: [],
      trashedLists: [],
    };
  }
  const search = (board: BoardState) =>
    searchBoards([{ boardId: createBoardId(), boardName: "B", board }], "hidden");

  it("finds postgame text in a two-thots list", () => {
    expect(search(boardWith({}))).toHaveLength(1);
  });

  it("skips postgame text the list hides", () => {
    expect(search(boardWith({ singleThots: true }))).toHaveLength(0);
  });
});
