import type { Card, List } from "./types";

/**
 * Thots: a card's notes. A list either gives each card two of them, pregame
 * and postgame (the default), or just one (`List.singleThots`).
 *
 * The single box is the pregame field, `Card.description`, under the plain
 * label "thots": that is the field every card has had longest, so switching
 * a list to single keeps what most cards already say. Postgame text is kept,
 * hidden, so switching back to double brings it back.
 *
 * Set per list, not per card, like check circles: a list is either one you
 * look back on or it isn't, and one card with a flip button among cards
 * without would read as a mistake.
 */

export type ThotsSlot = "pregame" | "postgame";

/** What the list header's bulk button shows on every card. */
export type ColumnThotsMode = "hidden" | ThotsSlot;

export function isSingleThots(list: Pick<List, "singleThots">): boolean {
  return list.singleThots === true;
}

/** The bulk button's cycle: hidden -> pregame -> postgame -> hidden, or
    just hidden <-> thots when the list has one. */
export function nextColumnThotsMode(mode: ColumnThotsMode, single: boolean): ColumnThotsMode {
  if (mode === "hidden") return "pregame";
  if (mode === "pregame" && !single) return "postgame";
  return "hidden";
}

/** A slot's name on screen. */
export function thotsLabel(slot: ThotsSlot, single: boolean): string {
  if (single) return "thots";
  return slot === "pregame" ? "pregame thots" : "postgame thots";
}

/**
 * Cuts `text[start, end)` out of a title, for moving it into a thots box.
 * `picked` is the cut text, trimmed; `rest` is what the title keeps, with
 * the gap the cut leaves closed up -- "a big b" minus "big" is "a b", not
 * "a  b" -- and trimmed, as an edited title is.
 */
export function cutText(
  text: string,
  start: number,
  end: number,
): { readonly picked: string; readonly rest: string } {
  const before = text.slice(0, start).replace(/[ \t]+$/, "");
  const after = text.slice(end).replace(/^[ \t]+/, "");
  const joiner = before && after && !/\n$/.test(before) && !/^\n/.test(after) ? " " : "";
  return { picked: text.slice(start, end).trim(), rest: (before + joiner + after).trim() };
}

/** A thots box's text with `addition` added: on a new line under what is
    already there, or on its own when the box is empty. */
export function appendThot(existing: string | undefined, addition: string): string {
  const kept = existing?.trim() ?? "";
  return kept ? `${kept}\n${addition}` : addition;
}

/** A short look at what a thots box holds, for the move menu: "empty", or
    its first line cut to `max` characters. */
export function thotPreview(text: string | undefined, max = 28): string {
  const first = text?.trim().split("\n")[0] ?? "";
  if (!first) return "empty";
  return first.length > max ? `${first.slice(0, max - 1).trimEnd()}…` : first;
}

/**
 * A card with `title[start, end)` moved out of its title and onto the end of
 * one of its thots boxes. `title` is passed in rather than read from the
 * card, because the move happens mid-edit: the title being cut is the draft
 * in the field, which may not be saved yet. Returns the card unchanged when
 * nothing but whitespace is selected.
 */
export function moveTitleTextToThots(
  card: Card,
  title: string,
  start: number,
  end: number,
  slot: ThotsSlot,
): Card {
  const { picked, rest } = cutText(title, start, end);
  if (!picked) return card;
  return slot === "pregame"
    ? { ...card, title: rest, description: appendThot(card.description, picked) }
    : { ...card, title: rest, postgameDescription: appendThot(card.postgameDescription, picked) };
}
