import type { CheckMark } from "./types";

/**
 * Check marks: a list can give each of its cards a circle, and clicking the
 * circle steps it empty -> green -> red -> empty. One button that cycles,
 * rather than a menu of three, so marking a card is a single click and stays
 * as quick as ticking a box.
 *
 * Set per list (`List.hasChecks`), not per card: a list is either one you tick
 * through or it isn't, and a lone circle on one card would read as a mistake.
 */

const CYCLE: readonly (CheckMark | undefined)[] = [undefined, "green", "red"];

export function nextCheck(mark: CheckMark | undefined): CheckMark | undefined {
  return CYCLE[(CYCLE.indexOf(mark) + 1) % CYCLE.length];
}

/** What the circle is called for a screen reader and in its tooltip. */
export const CHECK_LABELS: Readonly<Record<CheckMark | "none", string>> = {
  none: "Not checked",
  green: "Green check",
  red: "Red check",
};
