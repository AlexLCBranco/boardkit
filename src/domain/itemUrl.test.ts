import { describe, expect, it } from "vitest";

import { copyCard, duplicateList } from "./duplicate";
import { EMPTY_HISTORY, pushEntry, stepRedo, stepUndo } from "./history";
import { mergeBoards } from "./merge";
import { readBoard, serializeBoard } from "./persistence";
import type { BoardState, CardId, ListId } from "./types";

const list = "l" as ListId;
const card = "c" as CardId;

function board(): BoardState {
  return {
    lists: { [list]: { id: list, title: "List", url: "https://example.com/list" } },
    cards: { [card]: { id: card, title: "Card", url: "https://example.com/card" } },
    listOrder: [list],
    cardOrder: { [list]: [card] },
    trash: [],
    trashedLists: [],
    background: undefined,
    collapsedLists: undefined,
    url: "https://example.com/board",
  };
}

const roundTrip = (b: BoardState) => readBoard(JSON.parse(JSON.stringify(serializeBoard(b))));

describe("links on cards, lists and the board", () => {
  it("are saved and read back", () => {
    const read = roundTrip(board());
    expect(read.status).toBe("ok");
    if (read.status !== "ok") return;
    expect(read.board.url).toBe("https://example.com/board");
    expect(read.board.lists[list].url).toBe("https://example.com/list");
    expect(read.board.cards[card].url).toBe("https://example.com/card");
  });

  it("a stored javascript: or data: link is dropped on load, never kept", () => {
    const b = board();
    const bad: BoardState = {
      ...b,
      url: "javascript:alert(1)",
      lists: { [list]: { ...b.lists[list], url: "data:text/html,x" } },
      cards: { [card]: { ...b.cards[card], url: "javascript:alert(2)" } },
    };
    const read = roundTrip(bad);
    if (read.status !== "ok") throw new Error(read.status);
    expect(read.board.url).toBeUndefined();
    expect(read.board.lists[list].url).toBeUndefined();
    expect(read.board.cards[card].url).toBeUndefined();
  });

  it("a copied card and a duplicated list keep their links", () => {
    const b = board();
    expect(copyCard(b.cards[card]).url).toBe("https://example.com/card");
    const dup = duplicateList(b, list, "Copy");
    const newList = dup.listOrder[1];
    expect(dup.lists[newList].url).toBe("https://example.com/list");
    expect(dup.cards[dup.cardOrder[newList][0]].url).toBe("https://example.com/card");
  });

  it("the board's link is undone and redone", () => {
    const b = board();
    const history = pushEntry(EMPTY_HISTORY, b, { url: "https://example.com/new" });
    const after = { ...b, url: "https://example.com/new" };
    const undo = stepUndo(history, after);
    expect(undo?.patch.url).toBe("https://example.com/board");
    const redo = stepRedo(undo!.history, { ...after, ...undo!.patch });
    expect(redo?.patch.url).toBe("https://example.com/new");
  });

  it("another tab's board link survives a merge; both changing it is a conflict", () => {
    const base = board();
    const mine = { ...base, cards: { [card]: { ...base.cards[card], title: "Renamed" } } };
    const theirs = { ...base, url: "https://example.com/theirs" };
    expect(mergeBoards(base, mine, theirs).board.url).toBe("https://example.com/theirs");
    const both = mergeBoards(base, { ...base, url: "https://example.com/mine" }, theirs);
    expect(both.conflicts).toEqual([{ kind: "link", title: "The board's link" }]);
  });
});
