/**
 * How card numbers look: a list-wide format and a per-card emphasis.
 *
 * The two are split on purpose. The format (digits, roman, letters...) is
 * the list's, because a sequence only reads as one if every number in it is
 * written the same way. The emphasis (badge, ring, bold, muted) is the
 * card's, so one card can be picked out without breaking the sequence.
 *
 * Only the text lives here. What an emphasis looks like is CSS
 * (`CardItem.module.css`, keyed off `data-number-emphasis`), since it is
 * paint, not data.
 *
 * Pure and React-free, like `numbering.ts`.
 */

import type { NumberEmphasis, NumberFormat } from "./types";

/** `"plain"` is the absent format, listed so the panel can offer it. */
export const PLAIN_FORMAT = "plain";
/** `"normal"` is the absent emphasis, listed so the panel can offer it. */
export const NORMAL_EMPHASIS = "normal";

export type NumberFormatChoice = NumberFormat | typeof PLAIN_FORMAT;
export type NumberEmphasisChoice = NumberEmphasis | typeof NORMAL_EMPHASIS;

/** The panel's choices, in order, with the label each one shows. A format's
    label is written in that format, so the choice previews itself. */
export const NUMBER_FORMAT_LABELS: Readonly<Record<NumberFormatChoice, string>> = {
  plain: "1 2 3",
  padded: "01 02",
  hash: "#1 #2",
  roman: "i ii iii",
  letters: "A B C",
};

export const NUMBER_EMPHASIS_LABELS: Readonly<Record<NumberEmphasisChoice, string>> = {
  normal: "Normal",
  badge: "Badge",
  ring: "Ring",
  bold: "Bold",
  muted: "Muted",
};

const ROMAN: readonly (readonly [number, string])[] = [
  [1000, "m"], [900, "cm"], [500, "d"], [400, "cd"],
  [100, "c"], [90, "xc"], [50, "l"], [40, "xl"],
  [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"],
];

function toRoman(n: number): string {
  let rest = n;
  let out = "";
  for (const [value, numeral] of ROMAN) {
    while (rest >= value) {
      out += numeral;
      rest -= value;
    }
  }
  return out;
}

/** Spreadsheet-column letters: A..Z, then AA, AB... so the sequence never
    runs out, however far continued numbering goes. */
function toLetters(n: number): string {
  let rest = n;
  let out = "";
  while (rest > 0) {
    rest -= 1;
    out = String.fromCharCode(65 + (rest % 26)) + out;
    rest = Math.floor(rest / 26);
  }
  return out;
}

export function formatNumber(n: number, format: NumberFormat | undefined): string {
  switch (format) {
    case "padded":
      return String(n).padStart(2, "0");
    case "hash":
      return `#${n}`;
    case "roman":
      return toRoman(n);
    case "letters":
      return toLetters(n);
    default:
      return String(n);
  }
}

/** Whether a format's numbers can outgrow the standard number strip:
    "lxxxviii" is eight characters where "88" is two. Such a list gets the
    wider strip (`--card-number-gutter-wide`). */
export function needsWideGutter(format: NumberFormat | undefined): boolean {
  return format === "roman" || format === "hash";
}
