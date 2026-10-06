import { beforeEach, describe, expect, it, vi } from "vitest";

import { createBoard } from "../domain/seed";
import type { BoardId } from "../domain/types";
import {
  hasPersistedBoard,
  loadPersistedBoard,
  openPersistedBoard,
  removePersistedBoard,
  savePersistedBoardNow,
  saveOtherBoardNow,
} from "./persistBoard";
import { savePersistedRegistryNow } from "./persistRegistry";
import { useSaveHealth } from "./saveHealthStore";

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
