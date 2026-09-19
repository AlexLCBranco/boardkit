/**
 * What each card type does, in one table.
 *
 * Numbering, the thots toggle and the customise panel read from here rather
 * than each checking `kind === "divider"`, so a new type is one entry below
 * plus its look in `CardItem`. Pure and React-free, like the rest of `domain/`.
 */

import { cardInk, type InkTone } from "./colors";
import { CARD_KINDS, type Card, type CardId, type CardKind, type ItemColor } from "./types";

export interface CardKindSpec {
  /** Shown in the customise panel's "Card type" choice. */
  readonly label: string;
  /** Whether the card takes a number, and counts toward the numbers after it. */
  readonly numbered: boolean;
  /** Whether the card has a thots section. A card that switches to a type
      without one keeps its thots, hidden, and gets them back on switching
      to a type that has them. */
  readonly hasThots: boolean;
  /** Whether the card's colour washes its whole background. A divider only
      colours its line, so its text never sits on the tint. */
  readonly tintsBackground: boolean;
  /** Whether the card takes its list's colour when it has none of its own.
      A note doesn't: it stays sticky-note yellow. */
  readonly inheritsListColor: boolean;
}

/** `"normal"` is the absent `kind`, listed so the panel can offer it. */
export const NORMAL_KIND = "normal";

export const CARD_KIND_SPECS: Readonly<Record<CardKind | typeof NORMAL_KIND, CardKindSpec>> = {
  normal: { label: "Normal", numbered: true, hasThots: true, tintsBackground: true, inheritsListColor: true },
  divider: { label: "Divider", numbered: false, hasThots: false, tintsBackground: false, inheritsListColor: true },
  note: { label: "Note", numbered: false, hasThots: false, tintsBackground: true, inheritsListColor: false },
};

/** The order the customise panel lists the types in. */
export const CARD_KIND_CHOICES = [NORMAL_KIND, ...CARD_KINDS] as const;

export function specOf(card: Pick<Card, "kind">): CardKindSpec {
  return CARD_KIND_SPECS[card.kind ?? NORMAL_KIND];
}

/**
 * The text tone a card needs, given its own colour and its list's. Reads the
 * type's spec for whether the colour reaches the card's background at all.
 */
export function inkOf(card: Pick<Card, "kind" | "color">, listColor: ItemColor | undefined): InkTone {
  const spec = specOf(card);
  if (!spec.tintsBackground) {
    return "default";
  }
  return cardInk(card.color ?? (spec.inheritsListColor ? listColor : undefined));
}

/** A `kind` from storage that this build knows, or `undefined` for anything
    else -- a type from a newer version, or a hand-edited backup. An unknown
    type must degrade to a normal card, never fail the load. */
export function knownKind(kind: unknown): CardKind | undefined {
  return CARD_KINDS.find((known) => known === kind);
}

/**
 * Strips unknown `kind`s from freshly loaded cards. Returns the same object
 * when there is nothing to strip, which is every board but a rare one.
 */
export function withKnownKinds(
  cards: Readonly<Record<CardId, Card>>,
): Readonly<Record<CardId, Card>> {
  const ids = Object.keys(cards) as CardId[];
  if (ids.every((id) => cards[id].kind === undefined || knownKind(cards[id].kind) !== undefined)) {
    return cards;
  }
  const cleaned: Record<CardId, Card> = { ...cards };
  for (const id of ids) {
    if (cleaned[id].kind !== undefined && knownKind(cleaned[id].kind) === undefined) {
      const { kind: _unknown, ...rest } = cleaned[id];
      cleaned[id] = rest;
    }
  }
  return cleaned;
}
