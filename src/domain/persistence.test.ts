import { describe, expect, it } from "vitest";

import { readBoard, serializeBoard } from "./persistence";
import { RECOVERED_LIST_TITLE } from "./repair";
import type { BoardState, CardId, ListId } from "./types";

const [todo, done, gone] = ["todo", "done", "gone"] as ListId[];
const [a, b, c, d] = ["a", "b", "c", "d"] as CardId[];

function healthy(): BoardState {
  return {
    lists: { [todo]: { id: todo, title: "To do" }, [done]: { id: done, title: "Done" } },
    cards: {
      [a]: { id: a, title: "A" },
      [b]: { id: b, title: "B" },
      [c]: { id: c, title: "C (trashed)" },
    },
    listOrder: [todo, done],
    cardOrder: { [todo]: [a], [done]: [b] },
    trash: [{ cardId: c, listId: todo, deletedAt: 1 }],
    trashedLists: [],
    background: undefined,
    collapsedLists: undefined,
  };
}

/** The saved JSON for `board`, with `change` applied to its board part. */
function saved(board: BoardState, change: (raw: Record<string, unknown>) => void = () => {}): unknown {
  const raw = JSON.parse(JSON.stringify(serializeBoard(board)));
  change(raw.board);
  return raw;
}

describe("readBoard", () => {
  it("reads a healthy board as ok, unchanged", () => {
    const read = readBoard(saved(healthy()));
    expect(read.status).toBe("ok");
    if (read.status === "ok") expect(read.board).toEqual(healthy());
  });

  it("does not count missing trash fields from older saves as damage", () => {
    const read = readBoard(
      saved(healthy(), (raw) => {
        delete raw.trashedLists;
        raw.trash = undefined;
        raw.cards = { [a]: { id: a, title: "A" }, [b]: { id: b, title: "B" } };
      }),
    );
    expect(read.status).toBe("ok");
  });

  it("keeps a trashed list out of the columns", () => {
    const board = { ...healthy(), listOrder: [todo], trashedLists: [{ listId: done, deletedAt: 5 }] };
    const read = readBoard(saved(board));
    expect(read.status).toBe("ok");
    if (read.status === "ok") expect(read.board.listOrder).toEqual([todo]);
  });

  it("is unreadable when there is nothing to salvage", () => {
    expect(readBoard(null).status).toBe("unreadable");
    expect(readBoard("text").status).toBe("unreadable");
    expect(readBoard({ version: 2, board: healthy() }).status).toBe("unreadable");
    expect(readBoard({ version: 1 }).status).toBe("unreadable");
    expect(readBoard({ version: 1, board: {} }).status).toBe("unreadable");
  });

  it("drops ids that point at nothing, and repeats", () => {
    const read = readBoard(
      saved(healthy(), (raw) => {
        raw.listOrder = [todo, gone, done, todo];
        raw.cardOrder = { [todo]: [a, "missing", a], [done]: [b] };
      }),
    );
    expect(read.status).toBe("repaired");
    if (read.status !== "repaired") return;
    expect(read.board.listOrder).toEqual([todo, done]);
    expect(read.board.cardOrder[todo]).toEqual([a]);
    expect(read.report).toEqual({ lost: 0, fixed: 4 });
  });

  it("keeps a card in only the first list it appears in", () => {
    const read = readBoard(saved(healthy(), (raw) => (raw.cardOrder = { [todo]: [a, b], [done]: [b] })));
    expect(read.status).toBe("repaired");
    if (read.status === "repaired") expect(read.board.cardOrder).toEqual({ [todo]: [a, b], [done]: [] });
  });

  it("gives a list with no card order an empty one", () => {
    const read = readBoard(saved(healthy(), (raw) => (raw.cardOrder = { [todo]: [a, b] })));
    expect(read.status).toBe("repaired");
    if (read.status === "repaired") expect(read.board.cardOrder[done]).toEqual([]);
  });

  it("puts back a list nothing shows", () => {
    const read = readBoard(saved(healthy(), (raw) => (raw.listOrder = [done])));
    expect(read.status).toBe("repaired");
    if (read.status === "repaired") expect(read.board.listOrder).toEqual([done, todo]);
  });

  it("puts cards nothing points at into a recovered list", () => {
    const read = readBoard(
      saved(healthy(), (raw) => {
        (raw.cards as Record<string, unknown>)[d] = { id: d, title: "D" };
        raw.cardOrder = { [todo]: [a], [done]: [] };
      }),
    );
    expect(read.status).toBe("repaired");
    if (read.status !== "repaired") return;
    const recovered = read.board.listOrder[2];
    expect(read.board.lists[recovered].title).toBe(RECOVERED_LIST_TITLE);
    expect(read.board.cardOrder[recovered]).toEqual([b, d]);
    // The trashed card stays in the trash.
    expect(read.board.trash.map((entry) => entry.cardId)).toEqual([c]);
  });

  it("drops entries that are not objects and fixes a missing title or mismatched id", () => {
    const read = readBoard(
      saved(healthy(), (raw) => {
        raw.cards = {
          [a]: { id: "other", title: "A" },
          [b]: { id: b },
          [c]: { id: c, title: "C (trashed)" },
          [d]: 42,
        };
      }),
    );
    expect(read.status).toBe("repaired");
    if (read.status !== "repaired") return;
    expect(read.board.cards[a].id).toBe(a);
    expect(read.board.cards[b].title).toBe("");
    expect(d in read.board.cards).toBe(false);
    expect(read.report).toEqual({ lost: 1, fixed: 2 });
  });

  it("drops a trash entry for a card that is also on the board", () => {
    const read = readBoard(saved(healthy(), (raw) => (raw.trash = [{ cardId: a, listId: todo, deletedAt: 1 }])));
    expect(read.status).toBe("repaired");
    if (read.status === "repaired") {
      expect(read.board.trash).toEqual([]);
      expect(read.board.cardOrder[todo]).toEqual([a]);
    }
  });

  it("silently drops an optional field this build does not know", () => {
    const read = readBoard(
      saved(healthy(), (raw) => ((raw.lists as Record<string, Record<string, unknown>>)[todo].icon = "unicorn")),
    );
    expect(read.status).toBe("ok");
    if (read.status === "ok") expect(read.board.lists[todo].icon).toBeUndefined();
  });
});
