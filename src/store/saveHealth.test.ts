import { beforeEach, describe, expect, it, vi } from "vitest";

import { createBoard } from "../domain/seed";
import type { BoardId } from "../domain/types";
import { removePersistedBoard, savePersistedBoardNow, saveOtherBoardNow } from "./persistBoard";
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
