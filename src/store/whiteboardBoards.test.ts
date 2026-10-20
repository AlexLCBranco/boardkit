import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readBoard, serializeBoard, serializeRegistry } from "../domain/persistence";
import { createBoard } from "../domain/seed";
import type { BoardId } from "../domain/types";

/**
 * The gauntlet whiteboard makes and renames boards without opening them
 * (`createWhiteboardBoard`, `renameWhiteboardBoard`). Runs the real board
 * store, in the whiteboard's embed mode, against an in-memory `localStorage`.
 */

const A = "boardA" as BoardId;
const B = "boardB" as BoardId;

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, String(value)),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
  };
}

const registry = () =>
  JSON.parse(localStorage.getItem("boardkit:registry")!) as { activeBoardId: string; boards: { id: string; name: string }[] };

function twoBoards() {
  localStorage.setItem(`boardkit:board:${A}`, JSON.stringify(serializeBoard(createBoard([{ title: "To do", cards: ["Rent"] }]), 1)));
  localStorage.setItem(`boardkit:board:${B}`, JSON.stringify(serializeBoard(createBoard([{ title: "Doing", cards: ["Plan"] }]), 1)));
  localStorage.setItem("boardkit:registry", JSON.stringify(serializeRegistry([{ id: A, name: "Week 36" }, { id: B, name: "Sprint" }], B)));
}

/** The store as the whiteboard loads it: embed mode, no board open. */
async function whiteboardStore() {
  vi.resetModules();
  const embed = await import("./embedStore");
  embed.setEmbeddedForTests({ id: "whiteboard:none" });
  return import("./boardStore");
}

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  vi.stubGlobal("window", new EventTarget());
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("createWhiteboardBoard", () => {
  it("stores an empty board, listed last, and leaves the app's active board alone", async () => {
    twoBoards();
    const { createWhiteboardBoard, useBoardStore } = await whiteboardStore();
    const id = createWhiteboardBoard("Untitled");
    expect(id).toBeTruthy();
    expect(registry().boards).toEqual([
      { id: A, name: "Week 36" },
      { id: B, name: "Sprint" },
      { id, name: "Untitled" },
    ]);
    expect(registry().activeBoardId).toBe(B);
    const read = readBoard(JSON.parse(localStorage.getItem(`boardkit:board:${id}`)!));
    expect(read.status).toBe("ok");
    if (read.status === "ok") expect(read.board.listOrder).toEqual([]);
    expect(useBoardStore.getState().boards.map((b) => b.id)).toEqual([A, B, id]);
  });

  it("two in a row are two boards", async () => {
    twoBoards();
    const { createWhiteboardBoard } = await whiteboardStore();
    const first = createWhiteboardBoard("Untitled");
    const second = createWhiteboardBoard("Untitled");
    expect(first).not.toBe(second);
    expect(registry().boards.map((b) => b.id)).toEqual([A, B, first, second]);
  });

  it("works where Boardkit was never opened: the new board is the whole list", async () => {
    const { createWhiteboardBoard } = await whiteboardStore();
    const id = createWhiteboardBoard("Untitled");
    expect(registry()).toEqual({ ...registry(), activeBoardId: id, boards: [{ id, name: "Untitled" }] });
  });

  it("keeps a list save the open board still had waiting", async () => {
    twoBoards();
    const { createWhiteboardBoard, openEmbeddedBoard, useBoardStore } = await whiteboardStore();
    openEmbeddedBoard(A);
    // A list save scheduled from the store's own copy, still in its 400 ms.
    useBoardStore.setState((s) => ({ boards: s.boards.map((b) => (b.id === A ? { ...b, name: "Week 37" } : b)) }));
    const id = createWhiteboardBoard("Untitled");
    vi.advanceTimersByTime(1000);
    expect(registry().boards).toEqual([
      { id: A, name: "Week 37" },
      { id: B, name: "Sprint" },
      { id, name: "Untitled" },
    ]);
  });

  it("refuses outside the whiteboard", async () => {
    vi.resetModules();
    const embed = await import("./embedStore");
    embed.setEmbeddedForTests(null);
    twoBoards();
    const { createWhiteboardBoard } = await import("./boardStore");
    expect(() => createWhiteboardBoard("x")).toThrow();
  });
});

describe("renameWhiteboardBoard", () => {
  it("renames only that board, open or not, and the store follows", async () => {
    twoBoards();
    const { renameWhiteboardBoard, openEmbeddedBoard, useBoardStore } = await whiteboardStore();
    renameWhiteboardBoard(A, "Week 40");
    expect(registry()).toEqual({ ...registry(), activeBoardId: B, boards: [{ id: A, name: "Week 40" }, { id: B, name: "Sprint" }] });
    openEmbeddedBoard(B);
    renameWhiteboardBoard(B, "Sprint 2");
    vi.advanceTimersByTime(1000);
    expect(registry().boards).toEqual([{ id: A, name: "Week 40" }, { id: B, name: "Sprint 2" }]);
    expect(useBoardStore.getState().boards).toEqual(registry().boards);
  });

  it("does nothing for a board that isn't listed", async () => {
    twoBoards();
    const before = localStorage.getItem("boardkit:registry");
    const { renameWhiteboardBoard } = await whiteboardStore();
    renameWhiteboardBoard("gone" as BoardId, "x");
    expect(localStorage.getItem("boardkit:registry")).toBe(before);
  });
});
