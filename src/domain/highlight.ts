/**
 * Card highlights: a border colour plus a style, both per card.
 *
 * Only the labels and the load-time cleaning live here. What each style
 * looks like is CSS (`CardItem.module.css`, keyed off `data-highlight`),
 * since it is paint, not data.
 *
 * Pure and React-free, like the rest of `domain/`.
 */

import { knownColor } from "./colors";
import { HIGHLIGHT_STYLES, type Card, type CardId, type HighlightStyle } from "./types";

/** `"ring"` is the absent style, listed so the panel can offer it. */
export const RING_HIGHLIGHT = "ring";

export type HighlightStyleChoice = HighlightStyle | typeof RING_HIGHLIGHT;

/** The panel's choices, in order, with the label each one shows. */
export const HIGHLIGHT_STYLE_LABELS: Readonly<Record<HighlightStyleChoice, string>> = {
  ring: "Ring",
  outline: "Outline",
  dashed: "Dashed",
  double: "Double",
  bar: "Top bar",
  pulse: "Pulse",
};

/** The value of a card's `data-highlight`, or `undefined` for none. */
export function highlightStyleOf(card: Pick<Card, "highlight" | "highlightStyle">): HighlightStyleChoice | undefined {
  return card.highlight === undefined ? undefined : (card.highlightStyle ?? RING_HIGHLIGHT);
}

function isClean(card: Card): boolean {
  return (
    (card.highlight === undefined || knownColor(card.highlight) === card.highlight) &&
    (card.highlightStyle === undefined || HIGHLIGHT_STYLES.includes(card.highlightStyle))
  );
}

/**
 * Drops a highlight colour or style this build can't read (from a newer
 * version, or a hand-edited backup), so the card loads without it instead
 * of breaking the board. Returns the same object when nothing needs
 * changing, which is almost every board.
 */
export function withKnownHighlights(
  cards: Readonly<Record<CardId, Card>>,
): Readonly<Record<CardId, Card>> {
  const ids = Object.keys(cards) as CardId[];
  if (ids.every((id) => isClean(cards[id]))) {
    return cards;
  }
  const cleaned: Record<CardId, Card> = { ...cards };
  for (const id of ids) {
    if (!isClean(cleaned[id])) {
      const { highlight: unknownColor, highlightStyle: unknownStyle, ...rest } = cleaned[id];
      const highlight = knownColor(unknownColor);
      const highlightStyle = HIGHLIGHT_STYLES.find((known) => known === unknownStyle);
      cleaned[id] = {
        ...rest,
        ...(highlight === undefined ? {} : { highlight }),
        ...(highlightStyle === undefined ? {} : { highlightStyle }),
      };
    }
  }
  return cleaned;
}
