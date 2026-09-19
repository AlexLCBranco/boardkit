/**
 * Pure search maths, in the same spirit as `trash.ts` and `transfer.ts`: no
 * React, no store, so the matching rules are plain functions that can be
 * tested on their own. Where the boards come from (the live store, or
 * `localStorage`) is the caller's business -- see `store/searchSources.ts`.
 */

import type { BoardId, BoardState, CardId, ListId } from "./types";

/** Which part of a card matched. Titles win over thots, pregame over
    postgame: a card produces one hit, for the first field that matches. */
export type SearchField = "title" | "pregame" | "postgame";

/** A matched piece of text split around the match, so the UI can draw the
    match in bold without this file knowing anything about markup. */
export interface Excerpt {
  /** Trimmed with a leading "…" when the text continued before this. */
  readonly before: string;
  readonly match: string;
  /** Trimmed with a trailing "…" when the text continued after this. */
  readonly after: string;
}

export interface SearchHit {
  readonly boardId: BoardId;
  readonly boardName: string;
  readonly listId: ListId;
  readonly listTitle: string;
  readonly cardId: CardId;
  readonly cardTitle: string;
  readonly field: SearchField;
  readonly excerpt: Excerpt;
}

/** One board to search, already loaded. Order in the array is result order. */
export interface SearchSource {
  readonly boardId: BoardId;
  readonly boardName: string;
  readonly board: BoardState;
}

/** More than this is not a list anyone reads; refining the query is better. */
export const MAX_SEARCH_RESULTS = 100;

/** How much text to keep either side of the match in a thot excerpt. */
const EXCERPT_RADIUS = 36;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Splits `text` around the first case-insensitive occurrence of `query`, or
 * returns `null` when it does not occur. Whitespace (including the line
 * breaks a thot can hold) is collapsed first, so an excerpt is always one
 * line. A regex rather than `toLowerCase().indexOf`, because lower-casing can
 * change a string's length (e.g. "İ") and shift every index after it.
 */
export function excerptAround(text: string, query: string, radius = EXCERPT_RADIUS): Excerpt | null {
  const needle = query.trim().replace(/\s+/g, " ");
  if (needle === "") return null;

  const flat = text.replace(/\s+/g, " ").trim();
  const found = new RegExp(escapeRegExp(needle), "i").exec(flat);
  if (!found) return null;

  const start = found.index;
  const end = start + found[0].length;
  const from = Math.max(0, start - radius);
  const to = Math.min(flat.length, end + radius);
  return {
    before: (from > 0 ? "…" : "") + flat.slice(from, start),
    match: found[0],
    after: flat.slice(end, to) + (to < flat.length ? "…" : ""),
  };
}

/**
 * Every card on `sources` that contains `query`, in source order, then list
 * order, then card order.
 *
 * Only cards that are *on* the board are searched: those in the `cardOrder`
 * of a list in `listOrder`. A trashed card has left its `cardOrder`, and a
 * trashed list has left `listOrder`, yet both stay in `cards`/`lists` (see
 * `trash.ts`) -- walking the ordering arrays rather than the flat tables is
 * what keeps them out.
 *
 * An empty query returns nothing, not everything.
 */
export function searchBoards(sources: readonly SearchSource[], query: string): SearchHit[] {
  if (query.trim() === "") return [];

  const hits: SearchHit[] = [];
  for (const { boardId, boardName, board } of sources) {
    for (const listId of board.listOrder) {
      const list = board.lists[listId];
      for (const cardId of board.cardOrder[listId] ?? []) {
        const card = board.cards[cardId];
        if (!card) continue;

        const candidates: readonly [SearchField, string | undefined][] = [
          ["title", card.title],
          ["pregame", card.description],
          ["postgame", card.postgameDescription],
        ];
        for (const [field, text] of candidates) {
          const excerpt = text ? excerptAround(text, query) : null;
          if (!excerpt) continue;
          hits.push({
            boardId,
            boardName,
            listId,
            listTitle: list.title,
            cardId,
            cardTitle: card.title,
            field,
            excerpt,
          });
          if (hits.length >= MAX_SEARCH_RESULTS) return hits;
          break;
        }
      }
    }
  }
  return hits;
}
