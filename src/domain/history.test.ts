import { describe, expect, it } from "vitest";

import { EMPTY_HISTORY, pushEntry, stepRedo, stepUndo, type BoardPatch, type History } from "./history";
import { sameBoard } from "./merge";
import { moveWithinList } from "./ordering";
import { moveCardToTrash } from "./trash";
import type { BoardState, Card, CardId, HexColor, ListId } from "./types";

const a = "a" as ListId;
const b = "b" as ListId;
const c = (n: number) => `c${n}` as CardId;

/** Two lists: `a` holding c1-c3, `b` holding c4-c5. */
function start(): BoardState {
  const cards: Record<CardId, Card> = {};
  for (let n = 1; n <= 5; n++) cards[c(n)] = { id: c(n), title: `Card ${n}` };
  return {
    lists: { [a]: { id: a, title: "A" }, [b]: { id: b, title: "B" } },
    cards,
    listOrder: [a, b],
    cardOrder: { [a]: [c(1), c(2), c(3)], [b]: [c(4), c(5)] },
    trash: [],
    trashedLists: [],
    background: undefined,
    collapsedLists: undefined,
  };
}

const renamePatch = (board: BoardState, id: CardId, title: string): BoardPatch => ({
  cards: { ...board.cards, [id]: { ...board.cards[id], title } },
});

/** Runs `patch` on `board` the way the store's `withHistory` does. */
function act(board: BoardState, history: History, patch: BoardPatch): [BoardState, History] {
  return [{ ...board, ...patch }, pushEntry(history, board, patch)];
}

/** A change taken in from outside: the board changes, the history doesn't. */
const outside = (board: BoardState, patch: BoardPatch): BoardState => ({ ...board, ...patch });

describe("undo and redo with nothing from outside", () => {
  it("puts the step's own slices back, as they were", () => {
    const board = start();
    const [renamed, history] = act(board, EMPTY_HISTORY, renamePatch(board, c(1), "Rent"));
    const step = stepUndo(history, renamed);
    expect(step?.conflicts).toEqual([]);
    expect(step?.patch.cards).toBe(board.cards);
  });
});

describe("undo after another tab's change", () => {
  it("puts back only the step's own card, keeping the other tab's", () => {
    const board = start();
    const [renamed, history] = act(board, EMPTY_HISTORY, renamePatch(board, c(1), "Rent"));
    const now = outside(renamed, renamePatch(renamed, c(2), "Buy"));

    const step = stepUndo(history, now)!;
    const result = { ...now, ...step.patch };
    expect(step.conflicts).toEqual([]);
    expect(result.cards[c(1)].title).toBe("Card 1");
    expect(result.cards[c(2)].title).toBe("Buy");
    // Untouched objects stay the same, so they don't re-render.
    expect(result.cards[c(3)]).toBe(now.cards[c(3)]);
    expect(step.history).toEqual({ past: [], future: history.past });
  });

  it("undoes a move without losing a card the other tab added to that list", () => {
    const board = start();
    const [moved, history] = act(board, EMPTY_HISTORY, {
      cardOrder: { ...board.cardOrder, [a]: moveWithinList(board.cardOrder[a], c(1), c(3)) },
    });
    const now = outside(moved, {
      cards: { ...moved.cards, [c(9)]: { id: c(9), title: "New" } },
      cardOrder: { ...moved.cardOrder, [b]: [c(4), c(5), c(9)] },
    });

    const result = { ...now, ...stepUndo(history, now)!.patch };
    expect(result.cardOrder[a]).toEqual([c(1), c(2), c(3)]);
    expect(result.cardOrder[b]).toEqual([c(4), c(5), c(9)]);
  });

  it("undoes a delete, the card coming back where it was", () => {
    const board = start();
    const [deleted, history] = act(board, EMPTY_HISTORY, moveCardToTrash(board, a, c(2), 1));
    const now = outside(deleted, renamePatch(deleted, c(4), "Elsewhere"));

    const result = { ...now, ...stepUndo(history, now)!.patch };
    expect(result.cardOrder[a]).toEqual([c(1), c(2), c(3)]);
    expect(result.trash).toEqual([]);
    expect(result.cards[c(4)].title).toBe("Elsewhere");
  });

  it("is refused when the other tab changed the same card, and older steps go", () => {
    const board = start();
    let [now, history] = act(board, EMPTY_HISTORY, renamePatch(board, c(3), "First"));
    [now, history] = act(now, history, renamePatch(now, c(1), "Rent"));
    [now, history] = act(now, history, renamePatch(now, c(2), "Mine"));
    const redoable = stepUndo(history, now)!;
    now = { ...now, ...redoable.patch };
    now = outside(now, renamePatch(now, c(1), "Theirs"));

    const step = stepUndo(redoable.history, now)!;
    expect(step.conflicts).toEqual([{ kind: "card", title: "Theirs" }]);
    expect(step.patch).toEqual({});
    // Nothing older is left to undo; what was undone can still be redone.
    expect(step.history).toEqual({ past: [], future: redoable.history.future });
  });

  it("names the background when both changed it", () => {
    const board = start();
    const [painted, history] = act(board, EMPTY_HISTORY, { background: { kind: "color", color: "#112233" as HexColor } });
    const now = outside(painted, { background: { kind: "color", color: "#445566" as HexColor } });
    expect(stepUndo(history, now)?.conflicts).toEqual([{ kind: "background", title: "The background" }]);
  });

  it("walks back several steps in a row, each item by item", () => {
    const board = start();
    let [now, history] = act(board, EMPTY_HISTORY, renamePatch(board, c(1), "One"));
    [now, history] = act(now, history, renamePatch(now, c(2), "Two"));
    now = outside(now, renamePatch(now, c(5), "Theirs"));

    for (let i = 0; i < 2; i++) {
      const step = stepUndo(history, now)!;
      expect(step.conflicts).toEqual([]);
      now = { ...now, ...step.patch };
      history = step.history;
    }
    expect(sameBoard(now, outside(board, renamePatch(board, c(5), "Theirs")))).toBe(true);
  });
});

describe("redo after another tab's change", () => {
  it("puts the step back item by item", () => {
    const board = start();
    const [renamed, history] = act(board, EMPTY_HISTORY, renamePatch(board, c(1), "Rent"));
    const undone = stepUndo(history, renamed)!;
    const now = outside({ ...renamed, ...undone.patch }, renamePatch(board, c(2), "Buy"));

    const step = stepRedo(undone.history, now)!;
    const result = { ...now, ...step.patch };
    expect(step.conflicts).toEqual([]);
    expect(result.cards[c(1)].title).toBe("Rent");
    expect(result.cards[c(2)].title).toBe("Buy");
  });

  it("is refused when the other tab changed the same card, leaving nothing to redo", () => {
    const board = start();
    const [renamed, history] = act(board, EMPTY_HISTORY, renamePatch(board, c(1), "Rent"));
    const undone = stepUndo(history, renamed)!;
    const now = outside({ ...renamed, ...undone.patch }, renamePatch(board, c(1), "Theirs"));

    const step = stepRedo(undone.history, now)!;
    expect(step.conflicts).toEqual([{ kind: "card", title: "Theirs" }]);
    expect(step.history).toEqual({ past: [], future: [] });
  });
});
