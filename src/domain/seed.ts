import { createCardId, createListId } from "./ids";
import type { BoardState, Card, CardId, List, ListId } from "./types";

/**
 * Board construction helpers.
 *
 * `createBoard` is the single place that assembles a valid `BoardState`, so
 * the invariant "every id in `listOrder` has an entry in `lists`, and every
 * list has a `cardOrder` array" is guaranteed by construction rather than by
 * hoping each caller remembers it.
 */

interface ListBlueprint {
  readonly title: string;
  readonly cards: readonly string[];
}

export function createBoard(blueprints: readonly ListBlueprint[]): BoardState {
  const lists: Record<ListId, List> = {};
  const cards: Record<CardId, Card> = {};
  const listOrder: ListId[] = [];
  const cardOrder: Record<ListId, CardId[]> = {};

  for (const blueprint of blueprints) {
    const listId = createListId();

    lists[listId] = { id: listId, title: blueprint.title };
    listOrder.push(listId);
    cardOrder[listId] = [];

    for (const title of blueprint.cards) {
      const cardId = createCardId();
      cards[cardId] = { id: cardId, title };
      cardOrder[listId].push(cardId);
    }
  }

  return { lists, cards, listOrder, cardOrder };
}

/** The board a first-time user sees. */
export function createSeedBoard(): BoardState {
  return createBoard([
    {
      title: "Backlog",
      cards: [
        "Sketch the card grid",
        "Decide on the ordering model",
        "Read the dnd-kit sensors documentation",
        "Collect reference boards worth stealing from",
      ],
    },
    {
      title: "In progress",
      cards: ["Normalised store", "Selector layer"],
    },
    {
      title: "Done",
      cards: ["Project scaffold", "Design tokens", "Board canvas shell"],
    },
    {
      title: "Parked",
      cards: [],
    },
  ]);
}

/**
 * A deliberately oversized board, used to measure rendering and drag cost in
 * milestone 6. It exists now so that performance can be checked at any point
 * without first having to invent test data.
 */
export function createLargeBoard(listCount = 10, cardsPerList = 100): BoardState {
  return createBoard(
    Array.from({ length: listCount }, (_, listIndex) => ({
      title: `List ${listIndex + 1}`,
      cards: Array.from(
        { length: cardsPerList },
        (_, cardIndex) => `Card ${listIndex + 1}.${cardIndex + 1}`,
      ),
    })),
  );
}
