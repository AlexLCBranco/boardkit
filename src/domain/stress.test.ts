import { describe, expect, it } from "vitest";

import { EMPTY_HISTORY, pushEntry, stepRedo, stepUndo, type BoardPatch, type History } from "./history";
import { mergeBoards, sameBoard } from "./merge";
import { insertAt, moveBetweenLists, moveList, moveWithinList } from "./ordering";
import { readBoard, serializeBoard } from "./persistence";
import {
  moveCardToTrash,
  moveListToTrash,
  permanentlyDeleteCard,
  restoreCardFromTrash,
  restoreListFromTrash,
} from "./trash";
import type { BoardState, CardId, HexColor, ListId } from "./types";

/** Small seeded generator, so a failure replays exactly. */
function random(seed: number) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number) => Math.floor(next() * n);
  const pick = <T,>(items: readonly T[]): T | undefined => (items.length ? items[int(items.length)] : undefined);
  return { int, pick };
}

function start(): BoardState {
  const l = (n: number) => `l${n}` as ListId;
  const c = (n: number) => `c${n}` as CardId;
  return {
    lists: { [l(1)]: { id: l(1), title: "L1" }, [l(2)]: { id: l(2), title: "L2" }, [l(3)]: { id: l(3), title: "L3" } },
    cards: Object.fromEntries([1, 2, 3, 4, 5, 6].map((n) => [c(n), { id: c(n), title: `C${n}` }])),
    listOrder: [l(1), l(2), l(3)],
    cardOrder: { [l(1)]: [c(1), c(2), c(3)], [l(2)]: [c(4), c(5)], [l(3)]: [c(6)] },
    trash: [],
    trashedLists: [],
    background: undefined,
    collapsedLists: undefined,
  };
}

const healthy = (board: BoardState) => readBoard(serializeBoard(board)).status;

/** One random edit, as the store would make it: a patch of whole slices. */
function randomEdit(board: BoardState, rnd: ReturnType<typeof random>, tag: string, n: number): BoardPatch | null {
  const lists = board.listOrder;
  const listId = rnd.pick(lists);
  const order = listId ? board.cardOrder[listId] : [];
  const cardId = rnd.pick(order);
  switch (rnd.int(11)) {
    case 0:
      return cardId ? { cards: { ...board.cards, [cardId]: { ...board.cards[cardId], title: `${tag}${n}` } } } : null;
    case 1: {
      if (!listId) return null;
      const id = `${tag}c${n}` as CardId;
      return {
        cards: { ...board.cards, [id]: { id, title: id } },
        cardOrder: { ...board.cardOrder, [listId]: insertAt(order, id, rnd.int(order.length + 1)) },
      };
    }
    case 2: {
      const over = rnd.pick(order);
      return listId && cardId && over ? { cardOrder: { ...board.cardOrder, [listId]: moveWithinList(order, cardId, over) } } : null;
    }
    case 3: {
      const to = rnd.pick(lists);
      if (!listId || !cardId || !to || to === listId) return null;
      return { cardOrder: moveBetweenLists(board.cardOrder, cardId, listId, to, rnd.pick(board.cardOrder[to]) ?? null) };
    }
    case 4:
      return listId && cardId ? moveCardToTrash(board, listId, cardId, n) : null;
    case 5: {
      const entry = rnd.pick(board.trash);
      return entry ? restoreCardFromTrash(board, entry.cardId) : null;
    }
    case 6: {
      const entry = rnd.pick(board.trash);
      return entry ? permanentlyDeleteCard(board, entry.cardId) : null;
    }
    case 7:
      return listId && lists.length > 1 ? moveListToTrash(board, listId, n) : null;
    case 8: {
      const entry = rnd.pick(board.trashedLists);
      return entry ? restoreListFromTrash(board, entry.listId) : null;
    }
    case 9: {
      const over = rnd.pick(lists);
      return listId && over ? { listOrder: moveList(lists, listId, over) } : null;
    }
    default: {
      if (rnd.int(2) === 0 && listId) {
        return { lists: { ...board.lists, [listId]: { ...board.lists[listId], title: `${tag}L${n}` } } };
      }
      return { background: { kind: "color", color: `#${String(n % 10).repeat(6)}` as HexColor } };
    }
  }
}

/** `count` random edits recorded the way `withHistory` records them. */
function edits(board: BoardState, history: History, rnd: ReturnType<typeof random>, tag: string, count: number) {
  for (let n = 0; n < count; n++) {
    const patch = randomEdit(board, rnd, tag, n);
    if (!patch) continue;
    history = pushEntry(history, board, patch);
    board = { ...board, ...patch };
    expect(healthy(board), `${tag} edit ${n}`).toBe("ok");
  }
  return { board, history };
}

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1);

describe("stress: random edits", () => {
  it("never leave a board that needs repair", () => {
    for (const seed of SEEDS) edits(start(), EMPTY_HISTORY, random(seed), "m", 30);
  });

  it("undo all the way back is the starting board, redo all the way is the end", () => {
    for (const seed of SEEDS) {
      const { board: end, history } = edits(start(), EMPTY_HISTORY, random(seed), "m", 20);
      let board = end;
      let h = history;
      for (let step = stepUndo(h, board); step; step = stepUndo(h, board)) {
        expect(step.conflicts).toEqual([]);
        board = { ...board, ...step.patch };
        h = step.history;
      }
      expect(sameBoard(board, start()), `seed ${seed}`).toBe(true);
      for (let step = stepRedo(h, board); step; step = stepRedo(h, board)) {
        board = { ...board, ...step.patch };
        h = step.history;
      }
      expect(sameBoard(board, end), `seed ${seed}`).toBe(true);
    }
  });
});

describe("stress: two tabs", () => {
  it("merging never leaves a board that needs repair", () => {
    for (const seed of SEEDS) {
      const rnd = random(seed);
      const base = start();
      const mine = edits(base, EMPTY_HISTORY, rnd, "m", 1 + rnd.int(8)).board;
      const theirs = edits(base, EMPTY_HISTORY, rnd, "t", 1 + rnd.int(8)).board;
      const { board } = mergeBoards(base, mine, theirs);
      expect(healthy(board), `seed ${seed}`).toBe("ok");
    }
  });

  it("undo after an outside change never leaves a board that needs repair", () => {
    let refused = 0;
    for (const seed of SEEDS) {
      const rnd = random(seed);
      let { board, history } = edits(start(), EMPTY_HISTORY, rnd, "m", 1 + rnd.int(8));
      board = edits(board, EMPTY_HISTORY, rnd, "t", 1 + rnd.int(4)).board;
      for (let step = stepUndo(history, board); step; step = stepUndo(history, board)) {
        board = { ...board, ...step.patch };
        history = step.history;
        expect(healthy(board), `seed ${seed}`).toBe("ok");
        if (step.conflicts.length) refused += 1;
      }
    }
    // Both kinds of outcome were exercised.
    expect(refused).toBeGreaterThan(0);
  });
});

describe("stress: redo after an outside change", () => {
  it("never leaves a board that needs repair", () => {
    for (const seed of SEEDS) {
      const rnd = random(seed);
      let { board, history } = edits(start(), EMPTY_HISTORY, rnd, "m", 1 + rnd.int(8));
      for (let i = rnd.int(history.past.length + 1); i > 0; i--) {
        const step = stepUndo(history, board)!;
        board = { ...board, ...step.patch };
        history = step.history;
      }
      board = edits(board, EMPTY_HISTORY, rnd, "t", 1 + rnd.int(4)).board;
      for (let step = stepRedo(history, board); step; step = stepRedo(history, board)) {
        board = { ...board, ...step.patch };
        history = step.history;
        expect(healthy(board), `seed ${seed}`).toBe("ok");
      }
    }
  });
});
