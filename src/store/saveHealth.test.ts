import { beforeEach, describe, expect, it, vi } from "vitest";

import { serializeBoard } from "../domain/persistence";
import { createBoard } from "../domain/seed";
import type { BoardId, BoardState } from "../domain/types";
import {
  catchUpBoard,
  hasPersistedBoard,
  loadPersistedBoard,
  openPersistedBoard,
  removePersistedBoard,
  savePersistedBoardNow,
  saveOtherBoardNow,
} from "./persistBoard";
import { savePersistedRegistryNow } from "./persistRegistry";
import { useSaveHealth } from "./saveHealthStore";
import { useSyncNotice } from "./syncNoticeStore";

/** A tiny localStorage (tests run in Node, which has none) that refuses
    writes while `state.full` is set, like a browser over its quota. */
function fillableStorage() {
  const data = new Map<string, string>();
  const state = { full: false };
  const storage: Storage = {
    get length() {
      return data.size;
    },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      if (state.full) throw new DOMException("full", "QuotaExceededError");
      data.set(k, String(v));
    },
    removeItem: (k) => void data.delete(k),
    clear: () => data.clear(),
  };
  vi.stubGlobal("localStorage", storage);
  return state;
}

const id = "board-1" as BoardId;

beforeEach(() => useSaveHealth.setState({ failing: [] }));

describe("save health", () => {
  it("reports a failed board save until the board saves again", () => {
    const storage = fillableStorage();
    storage.full = true;
    expect(savePersistedBoardNow(createBoard([]), id)).toBe(false);
    expect(useSaveHealth.getState().failing).toEqual([`boardkit:board:${id}`]);

    storage.full = false;
    expect(savePersistedBoardNow(createBoard([]), id)).toBe(true);
    expect(useSaveHealth.getState().failing).toEqual([]);
  });

  it("stops reporting a board that was deleted", () => {
    const storage = fillableStorage();
    storage.full = true;
    savePersistedBoardNow(createBoard([]), id);
    storage.full = false;
    removePersistedBoard(id);
    expect(useSaveHealth.getState().failing).toEqual([]);
  });

  it("a transfer's write says it failed, without holding the banner up", () => {
    const storage = fillableStorage();
    storage.full = true;
    expect(saveOtherBoardNow(createBoard([]), id)).toBe(false);
    expect(useSaveHealth.getState().failing).toEqual([]);
  });
});

describe("retrying every failed save", () => {
  it("writes a board that isn't open again, with the content it last tried", () => {
    const storage = fillableStorage();
    const other = "board-2" as BoardId;
    storage.full = true;
    savePersistedBoardNow(createBoard([]), id);
    savePersistedBoardNow(createBoard([]), other);
    expect(useSaveHealth.getState().failing).toHaveLength(2);

    storage.full = false;
    useSaveHealth.getState().retryAll();
    expect(useSaveHealth.getState().failing).toEqual([]);
    expect(localStorage.getItem(`boardkit:board:${other}`)).not.toBeNull();
  });

  it("keeps failing keys tracked while storage is still full", () => {
    const storage = fillableStorage();
    storage.full = true;
    savePersistedBoardNow(createBoard([]), id);
    useSaveHealth.getState().retryAll();
    expect(useSaveHealth.getState().failing).toEqual([`boardkit:board:${id}`]);
  });

  it("forgets the retry of a board that was deleted", () => {
    const storage = fillableStorage();
    storage.full = true;
    savePersistedBoardNow(createBoard([]), id);
    storage.full = false;
    removePersistedBoard(id);
    useSaveHealth.getState().retryAll();
    expect(localStorage.getItem(`boardkit:board:${id}`)).toBeNull();
  });
});

describe("a board whose save failed, read back in the same session", () => {
  it("opens with the content it was meant to save, not as missing", () => {
    const storage = fillableStorage();
    const fresh = "board-new" as BoardId;
    const board = createBoard([{ title: "Kept", cards: ["a"] }]);
    storage.full = true;
    savePersistedBoardNow(board, fresh);
    expect(openPersistedBoard(fresh)).toEqual({ board, damage: null });
    expect(hasPersistedBoard(fresh)).toBe(true);
    expect(loadPersistedBoard(fresh)).toBe(board);
  });

  it("is missing once nothing holds it (a later visit)", () => {
    fillableStorage();
    const gone = "board-gone" as BoardId;
    expect(openPersistedBoard(gone).damage?.status).toBe("missing");
    expect(hasPersistedBoard(gone)).toBe(false);
  });
});

describe("the saved board list", () => {
  const registryIds = () =>
    (JSON.parse(localStorage.getItem("boardkit:registry") ?? "{\"boards\":[]}") as { boards: { id: string }[] }).boards.map(
      (board) => board.id,
    );

  it("names a new board only once its content is stored", () => {
    const storage = fillableStorage();
    const kept = "board-kept" as BoardId;
    const fresh = "board-fresh" as BoardId;
    savePersistedBoardNow(createBoard([]), kept);
    const boards = [
      { id: kept, name: "Kept" },
      { id: fresh, name: "Fresh" },
    ];

    storage.full = true;
    savePersistedBoardNow(createBoard([]), fresh);
    storage.full = false;
    savePersistedRegistryNow(boards, fresh);
    expect(registryIds()).toEqual([kept]);
    // The active board falls back to one that is stored.
    expect(JSON.parse(localStorage.getItem("boardkit:registry")!).activeBoardId).toBe(kept);

    useSaveHealth.getState().retryAll();
    expect(registryIds()).toEqual([kept, fresh]);
  });

  it("writes no list at all while no board is stored", () => {
    const storage = fillableStorage();
    const only = "board-only" as BoardId;
    storage.full = true;
    savePersistedBoardNow(createBoard([]), only);
    storage.full = false;
    savePersistedRegistryNow([{ id: only, name: "Only" }], only);
    expect(localStorage.getItem("boardkit:registry")).toBeNull();
  });
});

describe("rev and newer versions", () => {
  const key = `boardkit:board:${id}`;
  const stored = () => JSON.parse(localStorage.getItem(key)!) as { version: number; rev: number };

  it("raises rev by one with every write, from whatever is stored", () => {
    fillableStorage();
    savePersistedBoardNow(createBoard([]), id);
    expect(stored()).toMatchObject({ version: 2, rev: 1 });
    savePersistedBoardNow(createBoard([{ title: "Changed", cards: [] }]), id);
    expect(stored().rev).toBe(2);
    // Nothing changed: nothing written, so other tabs aren't woken for it.
    const unchanged = localStorage.getItem(key);
    savePersistedBoardNow((JSON.parse(unchanged!) as { board: BoardState }).board, id);
    expect(localStorage.getItem(key)).toBe(unchanged);
    // Another writer (a tab, Linkkit) moved it on meanwhile.
    localStorage.setItem(key, JSON.stringify({ ...stored(), rev: 10 }));
    saveOtherBoardNow(createBoard([]), id);
    expect(stored().rev).toBe(11);
  });

  it("never writes over a board a newer Boardkit saved", () => {
    fillableStorage();
    const newer = JSON.stringify({ version: 3, rev: 5, board: createBoard([{ title: "New", cards: ["x"] }]) });
    localStorage.setItem(key, newer);
    expect(savePersistedBoardNow(createBoard([]), id)).toBe(false);
    expect(saveOtherBoardNow(createBoard([]), id)).toBe(false);
    expect(localStorage.getItem(key)).toBe(newer);
  });

  it("opens a newer board read-only: shown, held, not set aside", () => {
    fillableStorage();
    const other = "board-newer" as BoardId;
    const board = createBoard([{ title: "New", cards: ["x"] }]);
    const newer = JSON.stringify({ version: 3, rev: 5, board });
    localStorage.setItem(`boardkit:board:${other}`, newer);
    const opened = openPersistedBoard(other);
    expect(opened.board).toEqual(board);
    expect(opened.damage).toEqual({ boardId: other, status: "newer", lost: 0, setAsideKey: null });
    expect(loadPersistedBoard(other)).toBeNull();
    // Held: a save is skipped, not failed, and storage is untouched.
    expect(savePersistedBoardNow(createBoard([]), other)).toBe(true);
    expect(localStorage.getItem(`boardkit:board:${other}`)).toBe(newer);
    expect(useSaveHealth.getState().failing).toEqual([]);
    expect([...Array(localStorage.length).keys()].map((i) => localStorage.key(i))).toEqual([
      `boardkit:board:${other}`,
    ]);
  });
});

describe("another tab saved the board since (the rev check)", () => {
  type Stored = { rev: number; board: BoardState };
  const stored = (boardId: BoardId) => JSON.parse(localStorage.getItem(`boardkit:board:${boardId}`)!) as Stored;
  /** What another tab does: its own change, written at the next rev. */
  const writeAsOtherTab = (boardId: BoardId, change: (board: BoardState) => BoardState) => {
    const { rev, board } = stored(boardId);
    localStorage.setItem(`boardkit:board:${boardId}`, JSON.stringify(serializeBoard(change(board), rev + 1)));
  };
  const retitle = (board: BoardState, index: number, title: string): BoardState => {
    const listId = board.listOrder[index];
    return { ...board, lists: { ...board.lists, [listId]: { ...board.lists[listId], title } } };
  };

  /** A stored board this tab has open, with lists A and B. */
  function openTwoLists(boardId: BoardId) {
    const storage = fillableStorage();
    savePersistedBoardNow(createBoard([{ title: "A", cards: [] }, { title: "B", cards: [] }]), boardId);
    const { board } = openPersistedBoard(boardId);
    return { storage, board: board! };
  }

  it("keeps the other tab's change and this tab's", () => {
    const boardId = "board-merge" as BoardId;
    const { board } = openTwoLists(boardId);
    writeAsOtherTab(boardId, (theirs) => retitle(theirs, 0, "Theirs"));
    savePersistedBoardNow(retitle(board, 1, "Mine"), boardId);
    const { rev, board: saved } = stored(boardId);
    expect(rev).toBe(3);
    expect(saved.listOrder.map((listId) => saved.lists[listId].title)).toEqual(["Theirs", "Mine"]);
  });

  it("keeps theirs when both changed the same list, and says so", () => {
    const boardId = "board-conflict" as BoardId;
    const { board } = openTwoLists(boardId);
    writeAsOtherTab(boardId, (theirs) => retitle(theirs, 0, "Theirs"));
    savePersistedBoardNow(retitle(board, 0, "Mine"), boardId);
    const saved = stored(boardId).board;
    expect(saved.lists[saved.listOrder[0]].title).toBe("Theirs");
    expect(useSyncNotice.getState().message?.text).toBe(
      "“Theirs” was just changed in another tab, so that version was kept.",
    );
  });

  it("“Try again” merges too, never writing over the other tab's save", () => {
    const boardId = "board-retry" as BoardId;
    const { storage, board } = openTwoLists(boardId);
    storage.full = true;
    expect(savePersistedBoardNow(retitle(board, 1, "Mine"), boardId)).toBe(false);
    storage.full = false;
    writeAsOtherTab(boardId, (theirs) => retitle(theirs, 0, "Theirs"));
    useSaveHealth.getState().retryAll();
    const saved = stored(boardId).board;
    expect(saved.listOrder.map((listId) => saved.lists[listId].title)).toEqual(["Theirs", "Mine"]);
    expect(useSaveHealth.getState().failing).toEqual([]);
  });

  it("brings another tab's save into the board this tab has open", () => {
    const boardId = "board-pull" as BoardId;
    const { board } = openTwoLists(boardId);
    writeAsOtherTab(boardId, (theirs) => retitle(theirs, 0, "Theirs"));
    const result = catchUpBoard(boardId, board);
    expect(result.kind).toBe("merged");
    if (result.kind === "merged") expect(result.board.lists[board.listOrder[0]].title).toBe("Theirs");
    // Taken in, so there is nothing new to catch up with any more.
    expect(catchUpBoard(boardId, result.kind === "merged" ? result.board : board).kind).toBe("current");
  });
});
