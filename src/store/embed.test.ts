import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readEmbed, readToFrame } from "../domain/embed";
import { serializeBoard, serializeRegistry } from "../domain/persistence";
import { createBoard } from "../domain/seed";
import type { BoardId } from "../domain/types";

/**
 * Embed mode (gauntlet canvas): a frame shows the board its address names
 * and never changes which board the full app opens next. Runs the real
 * board store against an in-memory `localStorage`.
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

/** Every stored key and value, sorted. */
const storedNow = () =>
  JSON.stringify(
    Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)!)
      .sort()
      .map((key) => [key, localStorage.getItem(key)]),
  );

const registry = () => JSON.parse(localStorage.getItem("boardkit:registry")!) as { activeBoardId: string; boards: { id: string; name: string }[] };

/** Two saved boards; B was open last, so it is the app's active board. */
function twoBoards() {
  localStorage.setItem(`boardkit:board:${A}`, JSON.stringify(serializeBoard(createBoard([{ title: "To do", cards: ["Rent"] }]), 1)));
  localStorage.setItem(`boardkit:board:${B}`, JSON.stringify(serializeBoard(createBoard([{ title: "Doing", cards: ["Plan"] }]), 1)));
  localStorage.setItem("boardkit:registry", JSON.stringify(serializeRegistry([{ id: A, name: "Week 36" }, { id: B, name: "Sprint" }], B)));
}

/** A fresh board store in embed mode for `id` (or the full app, for
    `null`): the stores read the address once, as their modules load. */
async function freshStore(id: string | null) {
  vi.resetModules();
  const embed = await import("./embedStore");
  embed.setEmbeddedForTests(id === null ? null : { id });
  const { useBoardStore } = await import("./boardStore");
  const registryModule = await import("./persistRegistry");
  return { useBoardStore, embed, flushRegistry: registryModule.flushPersistRegistry };
}

/** What the browser sends this page when another tab or frame saves. */
function storageEvent(key: string): Event {
  const event = new Event("storage");
  Object.defineProperties(event, { key: { value: key }, storageArea: { value: localStorage } });
  return event;
}

let page: EventTarget;

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  // The store listens for other tabs' saves on `window`.
  page = new EventTarget();
  vi.stubGlobal("window", page);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("embed address", () => {
  it("reads ?embed=1&id=…, and nothing else", () => {
    expect(readEmbed("?embed=1&id=abc")).toEqual({ id: "abc" });
    expect(readEmbed("?id=abc&embed=1&damage-test")).toEqual({ id: "abc" });
    expect(readEmbed("?embed=1")).toBeNull();
    expect(readEmbed("?embed=1&id=%20")).toBeNull();
    expect(readEmbed("?embed=0&id=abc")).toBeNull();
    expect(readEmbed("")).toBeNull();
  });

  it("takes only the canvas's two messages", () => {
    expect(readToFrame({ type: "stone:flush" })).toEqual({ type: "stone:flush" });
    expect(readToFrame({ type: "stone:scroll-to", x: 4, y: 9 })).toEqual({ type: "stone:scroll-to", x: 4, y: 9 });
    expect(readToFrame({ type: "stone:scroll-to", x: "4", y: 9 })).toBeNull();
    expect(readToFrame({ type: "stone:scroll-to", x: Number.NaN, y: 9 })).toBeNull();
    expect(readToFrame({ type: "other" })).toBeNull();
    expect(readToFrame("stone:flush")).toBeNull();
  });
});

describe("a frame on the canvas", () => {
  it("opens the board its address names, not the one open last", async () => {
    twoBoards();
    const { useBoardStore, embed } = await freshStore(A);
    expect(useBoardStore.getState().boardId).toBe(A);
    expect(Object.values(useBoardStore.getState().cards).map((card) => card.title)).toEqual(["Rent"]);
    expect(embed.useEmbedStatus.getState().status).toBe("ok");
  });

  it("keeps the stored active board when it writes the board list", async () => {
    twoBoards();
    const { useBoardStore, flushRegistry } = await freshStore(A);
    useBoardStore.getState().renameBoard("Week 36 (renamed)");
    flushRegistry();
    expect(registry().boards.find((board) => board.id === A)?.name).toBe("Week 36 (renamed)");
    expect(registry().activeBoardId).toBe(B);
  });

  it("never opens, makes or deletes another board", async () => {
    twoBoards();
    const { useBoardStore, flushRegistry } = await freshStore(A);
    const before = storedNow();
    const store = useBoardStore.getState();
    store.switchBoard(B);
    store.createBoard("New");
    store.duplicateBoard("Copy");
    store.createBoardFromLayout("Layout");
    store.deleteBoard();
    flushRegistry();
    expect(useBoardStore.getState().boardId).toBe(A);
    expect(useBoardStore.getState().boards.map((board) => board.id)).toEqual([A, B]);
    expect(storedNow()).toBe(before);
  });

  it("says a board that isn't there is missing, and writes nothing", async () => {
    twoBoards();
    const before = storedNow();
    const { useBoardStore, embed, flushRegistry } = await freshStore("nope");
    expect(embed.useEmbedStatus.getState().status).toBe("missing");
    useBoardStore.getState().addList?.("Ignored");
    page.dispatchEvent(storageEvent("boardkit:registry"));
    flushRegistry();
    expect(storedNow()).toBe(before);
  });

  it("writes nothing on a first visit (no boards yet): no starter board", async () => {
    const { embed } = await freshStore(A);
    expect(embed.useEmbedStatus.getState().status).toBe("missing");
    expect(localStorage.length).toBe(0);
  });

  it("says its board was deleted in another tab, and opens no other", async () => {
    twoBoards();
    const { useBoardStore, embed } = await freshStore(A);
    localStorage.removeItem(`boardkit:board:${A}`);
    localStorage.setItem("boardkit:registry", JSON.stringify(serializeRegistry([{ id: B, name: "Sprint" }], B)));
    page.dispatchEvent(storageEvent(`boardkit:board:${A}`));
    page.dispatchEvent(storageEvent("boardkit:registry"));
    expect(embed.useEmbedStatus.getState().status).toBe("deleted");
    expect(useBoardStore.getState().boardId).toBe(A);
    expect(localStorage.getItem(`boardkit:board:${A}`)).toBeNull();
  });
});

describe("the full app, for contrast", () => {
  it("writes the board it switches to as the active one", async () => {
    twoBoards();
    const { useBoardStore, flushRegistry } = await freshStore(null);
    expect(useBoardStore.getState().boardId).toBe(B);
    useBoardStore.getState().switchBoard(A);
    flushRegistry();
    expect(registry().activeBoardId).toBe(A);
  });
});
