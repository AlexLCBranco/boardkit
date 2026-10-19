import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { serializeBoard, serializeRegistry } from "../domain/persistence";
import { createBoard } from "../domain/seed";
import type { BoardId, CardId, ListId } from "../domain/types";

/**
 * A card dragged into another list is saved when it is dropped, even when
 * the drop itself changes nothing more (into an empty list, or released
 * where its preview already sits): the move happened during the drag, as
 * previews that were deliberately not saved.
 */

const A = "boardA" as BoardId;

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

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  vi.stubGlobal("window", new EventTarget());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("saves a card dragged into another list when it is dropped without a final reorder", async () => {
  localStorage.setItem(`boardkit:board:${A}`, JSON.stringify(serializeBoard(createBoard([{ title: "To do", cards: ["Rent"] }, { title: "Done", cards: [] }]), 1)));
  localStorage.setItem("boardkit:registry", JSON.stringify(serializeRegistry([{ id: A, name: "Week" }], A)));
  vi.resetModules();
  const { useBoardStore } = await import("./boardStore");
  const { flushPersist } = await import("./persistBoard");
  const store = useBoardStore.getState();
  const [from, to] = store.listOrder as ListId[];
  const card = store.cardOrder[from][0] as CardId;

  store.beginCardDrag();
  useBoardStore.getState().moveCardBetweenLists(card, from, to, null);
  useBoardStore.getState().endCardDrag(null);
  flushPersist();

  const saved = JSON.parse(localStorage.getItem(`boardkit:board:${A}`)!) as { board: { cardOrder: Record<string, string[]> } };
  expect(saved.board.cardOrder[to]).toEqual([card]);
  expect(saved.board.cardOrder[from]).toEqual([]);
});
