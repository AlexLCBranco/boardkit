import { describe, expect, it } from "vitest";

import { mergeBoardLists, mergeBoards, movedIds, sameValue, shareUnchanged } from "./merge";
import { moveBetweenLists, moveWithinList } from "./ordering";
import { readBoard, serializeBoard } from "./persistence";
import { moveCardToTrash, moveListToTrash, permanentlyDeleteList } from "./trash";
import type { BoardId, BoardState, BoardSummary, Card, CardId, ListId } from "./types";

const a = "a" as ListId;
const b = "b" as ListId;
const c = (n: number) => `c${n}` as CardId;

/** Two lists: `a` holding c1-c3, `b` holding c4-c5. */
function base(): BoardState {
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

const rename = (board: BoardState, id: CardId, title: string): BoardState => ({
  ...board,
  cards: { ...board.cards, [id]: { ...board.cards[id], title } },
});

const addCard = (board: BoardState, listId: ListId, id: CardId, index: number): BoardState => {
  const order = [...board.cardOrder[listId]];
  order.splice(index, 0, id);
  return {
    ...board,
    cards: { ...board.cards, [id]: { id, title: id } },
    cardOrder: { ...board.cardOrder, [listId]: order },
  };
};

/** The merged board must read back exactly as written: nothing for the
    repair to fix (no card in two places, none lost, no list missing). */
function expectHealthy(board: BoardState) {
  expect(readBoard(serializeBoard(board)).status).toBe("ok");
}

describe("movedIds", () => {
  it("names only the item that moved, not the ones it shifted", () => {
    expect([...movedIds(["1", "2", "3", "4"], ["3", "1", "2", "4"])]).toEqual(["3"]);
  });
  it("names added items", () => {
    expect([...movedIds(["1", "2"], ["1", "x", "2"])]).toEqual(["x"]);
  });
  it("names nothing when the order is the same", () => {
    expect(movedIds(["1", "2"], ["1", "2"]).size).toBe(0);
  });
});

describe("sameValue", () => {
  it("treats an undefined key as a missing one", () => {
    expect(sameValue({ id: 1, color: undefined }, { id: 1 })).toBe(true);
    expect(sameValue({ id: 1, color: "red" }, { id: 1 })).toBe(false);
  });
});

describe("mergeBoards", () => {
  it("takes theirs when this tab changed nothing", () => {
    const theirs = rename(base(), c(1), "Theirs");
    expect(mergeBoards(base(), base(), theirs).board).toBe(theirs);
  });

  it("keeps both tabs' changes to different cards", () => {
    const mine = rename(base(), c(1), "Mine");
    const theirs = rename(base(), c(2), "Theirs");
    const { board, conflicts } = mergeBoards(base(), mine, theirs);
    expect(board.cards[c(1)].title).toBe("Mine");
    expect(board.cards[c(2)].title).toBe("Theirs");
    expect(conflicts).toEqual([]);
    expectHealthy(board);
  });

  it("keeps theirs and names the card when both changed it", () => {
    const mine = rename(base(), c(1), "Mine");
    const theirs = rename(base(), c(1), "Theirs");
    const { board, conflicts } = mergeBoards(base(), mine, theirs);
    expect(board.cards[c(1)].title).toBe("Theirs");
    expect(conflicts).toEqual([{ kind: "card", title: "Theirs" }]);
  });

  it("is no conflict when both made the same change", () => {
    const mine = rename(base(), c(1), "Same");
    const theirs = rename(base(), c(1), "Same");
    expect(mergeBoards(base(), mine, theirs).conflicts).toEqual([]);
  });

  it("treats a card renamed here and moved there as one item: theirs stays", () => {
    const mine = rename(base(), c(1), "Mine");
    const moved = base();
    const theirs = { ...moved, cardOrder: moveBetweenLists(moved.cardOrder, c(1), a, b, null) };
    const { board, conflicts } = mergeBoards(base(), mine, theirs);
    expect(board.cards[c(1)].title).toBe("Card 1");
    expect(board.cardOrder[b]).toContain(c(1));
    expect(conflicts.map((conflict) => conflict.title)).toEqual(["Card 1"]);
  });

  it("re-applies a move next to the same neighbour, keeping their new card", () => {
    // Here: c3 moved to the top of a. There: a new card x added after c1.
    const mine = { ...base(), cardOrder: { ...base().cardOrder, [a]: moveWithinList(base().cardOrder[a], c(3), c(1)) } };
    const theirs = addCard(base(), a, "x" as CardId, 1);
    const { board, conflicts } = mergeBoards(base(), mine, theirs);
    expect(board.cardOrder[a]).toEqual([c(3), c(1), "x", c(2)]);
    expect(conflicts).toEqual([]);
    expectHealthy(board);
  });

  it("re-applies a move between lists", () => {
    const start = base();
    const mine = { ...start, cardOrder: moveBetweenLists(start.cardOrder, c(2), a, b, c(5)) };
    const theirs = rename(base(), c(4), "Theirs");
    const { board } = mergeBoards(base(), mine, theirs);
    expect(board.cardOrder[a]).toEqual([c(1), c(3)]);
    expect(board.cardOrder[b]).toEqual(mine.cardOrder[b]);
    expect(board.cards[c(4)].title).toBe("Theirs");
    expectHealthy(board);
  });

  it("keeps both tabs' new cards in the same list", () => {
    const mine = addCard(base(), b, "m" as CardId, 2);
    const theirs = addCard(base(), b, "t" as CardId, 2);
    const { board } = mergeBoards(base(), mine, theirs);
    expect(board.cardOrder[b]).toEqual([c(4), c(5), "m", "t"]);
    expectHealthy(board);
  });

  it("re-applies a card trashed here", () => {
    const start = base();
    const mine = { ...start, ...moveCardToTrash(start, a, c(2), 100) };
    const theirs = rename(base(), c(1), "Theirs");
    const { board } = mergeBoards(base(), mine, theirs);
    expect(board.cardOrder[a]).toEqual([c(1), c(3)]);
    expect(board.trash).toEqual([{ cardId: c(2), listId: a, deletedAt: 100, prevCardId: c(1), nextCardId: c(3) }]);
    expect(board.cards[c(1)].title).toBe("Theirs");
    expectHealthy(board);
  });

  it("keeps a card trashed there that was renamed here, and names it", () => {
    const start = base();
    const mine = rename(start, c(2), "Mine");
    const theirs = { ...start, ...moveCardToTrash(start, a, c(2), 100) };
    const { board, conflicts } = mergeBoards(base(), mine, theirs);
    expect(board.trash.map((entry) => entry.cardId)).toEqual([c(2)]);
    expect(board.cards[c(2)].title).toBe("Card 2");
    expect(conflicts).toHaveLength(1);
    expectHealthy(board);
  });

  it("re-applies a new list and the cards put in it", () => {
    const n = "n" as ListId;
    const start = base();
    const withList: BoardState = {
      ...start,
      lists: { ...start.lists, [n]: { id: n, title: "New" } },
      listOrder: [a, n, b],
      cardOrder: { ...start.cardOrder, [n]: [] },
    };
    const mine = { ...withList, cardOrder: moveBetweenLists(withList.cardOrder, c(4), b, n, null) };
    const theirs = rename(base(), c(5), "Theirs");
    const { board } = mergeBoards(base(), mine, theirs);
    expect(board.listOrder).toEqual([a, n, b]);
    expect(board.cardOrder[n]).toEqual([c(4)]);
    expect(board.cardOrder[b]).toEqual([c(5)]);
    expectHealthy(board);
  });

  it("re-applies a trashed list", () => {
    const start = base();
    const mine = { ...start, ...moveListToTrash(start, a, 50) };
    const theirs = rename(base(), c(4), "Theirs");
    const { board } = mergeBoards(base(), mine, theirs);
    expect(board.listOrder).toEqual([b]);
    expect(board.trashedLists).toEqual([{ listId: a, deletedAt: 50 }]);
    expectHealthy(board);
  });

  it("keeps a list erased here when the other tab added a card to it", () => {
    const trashed = { ...base(), ...moveListToTrash(base(), a, 50) };
    const mine = { ...trashed, ...permanentlyDeleteList(trashed, a) };
    const theirs = addCard(trashed, a, "x" as CardId, 0);
    const { board, conflicts } = mergeBoards(trashed, mine, theirs);
    expect(board.lists[a]).toBeDefined();
    expect(board.cardOrder[a]).toEqual(["x"]);
    expect(board.trashedLists.map((entry) => entry.listId)).toEqual([a]);
    expect(conflicts.map((conflict) => conflict.kind)).toEqual(["list"]);
    expectHealthy(board);
  });

  it("erases a list erased here that the other tab left alone", () => {
    const trashed = { ...base(), ...moveListToTrash(base(), a, 50) };
    const mine = { ...trashed, ...permanentlyDeleteList(trashed, a) };
    const theirs = rename(trashed, c(4), "Theirs");
    const { board, conflicts } = mergeBoards(trashed, mine, theirs);
    expect(board.lists[a]).toBeUndefined();
    expect(board.cards[c(1)]).toBeUndefined();
    expect(conflicts).toEqual([]);
    expectHealthy(board);
  });

  it("names a card added here to a list the other tab erased", () => {
    const trashed = { ...base(), ...moveListToTrash(base(), a, 50) };
    const mine = addCard(trashed, a, "x" as CardId, 0);
    const theirs = { ...trashed, ...permanentlyDeleteList(trashed, a) };
    const { board, conflicts } = mergeBoards(trashed, mine, theirs);
    expect(board.lists[a]).toBeUndefined();
    expect(board.cards["x" as CardId]).toBeUndefined();
    expect(conflicts.map((conflict) => conflict.title)).toEqual(["x"]);
    expectHealthy(board);
  });

  it("re-applies a list moved here", () => {
    const mine = { ...base(), listOrder: [b, a] };
    const theirs = rename(base(), c(1), "Theirs");
    expect(mergeBoards(base(), mine, theirs).board.listOrder).toEqual([b, a]);
  });

  it("merges the background, naming it when both changed it", () => {
    const mine = { ...base(), background: { kind: "color" as const, color: "red" as const } };
    const theirs = { ...base(), background: { kind: "color" as const, color: "blue" as const } };
    const { board, conflicts } = mergeBoards(base(), mine, theirs);
    expect(board.background).toEqual(theirs.background);
    expect(conflicts).toEqual([{ kind: "background", title: "The background" }]);
  });

  it("merges folded lists flag by flag, silently", () => {
    const mine = { ...base(), collapsedLists: { [a]: true as const } };
    const theirs = { ...base(), collapsedLists: { [b]: true as const } };
    const { board, conflicts } = mergeBoards(base(), mine, theirs);
    expect(board.collapsedLists).toEqual({ [a]: true, [b]: true });
    expect(conflicts).toEqual([]);
  });
});

describe("shareUnchanged", () => {
  it("keeps the old objects for everything that didn't change", () => {
    const previous = base();
    const next = JSON.parse(JSON.stringify(rename(previous, c(1), "New"))) as BoardState;
    const shared = shareUnchanged(previous, next);
    expect(shared.cards[c(2)]).toBe(previous.cards[c(2)]);
    expect(shared.cards[c(1)]).not.toBe(previous.cards[c(1)]);
    expect(shared.lists).toBe(previous.lists);
    expect(shared.cardOrder).toBe(previous.cardOrder);
  });

  it("returns the old board when nothing changed", () => {
    const previous = base();
    expect(shareUnchanged(previous, JSON.parse(JSON.stringify(previous)))).toBe(previous);
  });
});

describe("mergeBoardLists", () => {
  const board = (id: string, name: string): BoardSummary => ({ id: id as BoardId, name });
  const start = [board("1", "One"), board("2", "Two")];

  it("keeps a board added in each tab", () => {
    const { boards } = mergeBoardLists(start, [...start, board("m", "Mine")], [...start, board("t", "Theirs")]);
    expect(boards.map((entry) => entry.id)).toEqual(["1", "2", "m", "t"]);
  });

  it("re-applies a rename and a delete", () => {
    const mine = [board("1", "Renamed")];
    const { boards, conflicts } = mergeBoardLists(start, mine, [...start, board("t", "Theirs")]);
    expect(boards).toEqual([board("1", "Renamed"), board("t", "Theirs")]);
    expect(conflicts).toEqual([]);
  });

  it("keeps theirs when a board was renamed here and deleted there", () => {
    const { boards, conflicts } = mergeBoardLists(start, [board("1", "Renamed"), start[1]], [start[1]]);
    expect(boards).toEqual([start[1]]);
    expect(conflicts).toEqual([{ kind: "board", id: "1", title: "Renamed" }]);
  });
});
