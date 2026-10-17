import { describe, expect, it } from "vitest";

import { createBoardId, createCardId, createListId } from "./ids";
import { searchBoards } from "./search";
import {
  appendThot,
  cutText,
  moveTitleTextToThots,
  nextColumnThotsMode,
  thotPreview,
  thotsLabel,
} from "./thots";
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

describe("cutText", () => {
  it("cuts the selection out and closes the gap", () => {
    expect(cutText("nba league pass ill pay", 4, 15)).toEqual({ picked: "league pass", rest: "nba ill pay" });
  });

  it("cuts from the start or the end", () => {
    expect(cutText("nba league pass", 0, 4)).toEqual({ picked: "nba", rest: "league pass" });
    expect(cutText("nba league pass", 3, 15)).toEqual({ picked: "league pass", rest: "nba" });
  });

  it("leaves an empty title when everything is cut", () => {
    expect(cutText("all of it", 0, 9)).toEqual({ picked: "all of it", rest: "" });
  });

  it("keeps a line break instead of adding a space", () => {
    expect(cutText("one\ntwo three", 4, 7)).toEqual({ picked: "two", rest: "one\nthree" });
  });
});

describe("appendThot", () => {
  it("fills an empty box", () => {
    expect(appendThot(undefined, "new")).toBe("new");
    expect(appendThot("  ", "new")).toBe("new");
  });

  it("adds a new line under existing text", () => {
    expect(appendThot("old", "new")).toBe("old\nnew");
  });
});

describe("moveTitleTextToThots", () => {
  const card: Card = { id: createCardId(), title: "saved", description: "old" };

  it("cuts from the draft title and adds to pregame", () => {
    const moved = moveTitleTextToThots(card, "nba league pass worth it", 16, 24, "pregame");
    expect(moved.title).toBe("nba league pass");
    expect(moved.description).toBe("old\nworth it");
    expect(moved.postgameDescription).toBeUndefined();
  });

  it("fills an empty postgame box", () => {
    const moved = moveTitleTextToThots(card, "a b", 2, 3, "postgame");
    expect(moved.title).toBe("a");
    expect(moved.postgameDescription).toBe("b");
    expect(moved.description).toBe("old");
  });

  it("changes nothing when only spaces are selected", () => {
    expect(moveTitleTextToThots(card, "a   b", 1, 4, "pregame")).toBe(card);
  });
});

describe("thotPreview", () => {
  it("says empty for an empty box", () => {
    expect(thotPreview(undefined)).toBe("empty");
    expect(thotPreview("")).toBe("empty");
  });

  it("shows the first line, shortened", () => {
    expect(thotPreview("short\nsecond")).toBe("short");
    expect(thotPreview("a very long first line of thots here", 10)).toBe("a very lo…");
  });
});
