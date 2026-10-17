import type { List } from "./types";

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
