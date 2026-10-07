import { describe, expect, it } from "vitest";

import { sameCardOrder, settleCardDrag } from "./cardDrag";
import { EMPTY_HISTORY, stepUndo } from "./history";
import { moveBetweenLists, moveWithinList } from "./ordering";
import { createEmptyBoard } from "./seed";
import type { BoardState, CardId, ListId } from "./types";

const [a, b, c, d] = ["a", "b", "c", "d"] as CardId[];
const [todo, doing, done] = ["todo", "doing", "done"] as ListId[];

const origin: BoardState["cardOrder"] = { [todo]: [a, b], [doing]: [c], [done]: [d] };

describe("sameCardOrder", () => {
  it("matches equal content in fresh arrays", () => {
    expect(sameCardOrder(origin, { [todo]: [a, b], [doing]: [c], [done]: [d] })).toBe(true);
  });

  it("tells apart a different order", () => {
    expect(sameCardOrder(origin, { [todo]: [b, a], [doing]: [c], [done]: [d] })).toBe(false);
  });

  it("tells apart a card in a different list", () => {
    expect(sameCardOrder(origin, { [todo]: [b], [doing]: [a, c], [done]: [d] })).toBe(false);
  });
});

describe("settleCardDrag", () => {
  it("records a drag across several lists as one undo step", () => {
    // Picked up in `todo`, crosses `doing`, dropped in `done`.
    const viaDoing = moveBetweenLists(origin, a, todo, doing, null);
    const final = moveBetweenLists(viaDoing, a, doing, done, null);

    const settled = settleCardDrag(EMPTY_HISTORY, origin, final);

    expect(settled.cardOrder).toBe(final);
    expect(settled.history.past).toHaveLength(1);
    expect(stepUndo(settled.history, { ...createEmptyBoard(), cardOrder: final })?.patch.cardOrder).toBe(origin);
  });

  it("records nothing for a drag that ends where it began", () => {
    const out = moveBetweenLists(origin, a, todo, doing, null);
    const back = moveBetweenLists(out, a, doing, todo, b);

    const settled = settleCardDrag(EMPTY_HISTORY, origin, back);

    expect(settled.history).toBe(EMPTY_HISTORY);
    // The origin's own references come back, so no list re-renders.
    expect(settled.cardOrder).toBe(origin);
  });

  it("includes a final within-list reorder in the same step", () => {
    const crossed = moveBetweenLists(origin, a, todo, doing, null);
    const final = { ...crossed, [doing]: moveWithinList(crossed[doing], a, c) };

    const settled = settleCardDrag(EMPTY_HISTORY, origin, final);

    expect(settled.cardOrder[doing]).toEqual([a, c]);
    expect(settled.history.past).toHaveLength(1);
  });

  it("clears redo, like any other change", () => {
    const final = moveBetweenLists(origin, a, todo, doing, null);
    const withFuture = { past: [], future: [{ before: {}, after: {} }] };

    expect(settleCardDrag(withFuture, origin, final).history.future).toEqual([]);
  });
});
