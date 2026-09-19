/**
 * JS-side mirrors of the few colour tokens the contrast maths needs.
 *
 * Same reasoning as `motion.ts`: working out whether text is readable on a
 * user-picked colour happens in JS, which can't read a `var(...)`. Keep these
 * in sync with `tokens.css` by hand.
 */

/** `--surface-raised`: what a card's tint is laid over. */
export const SURFACE_RAISED = "#1d2026";

/** `--text-primary`: the text colour a card uses unless told otherwise. */
export const TEXT_PRIMARY = "#e8eaee";

/** `--ink-light` and `--ink-dark`: the two text colours a card can switch to
    when a custom colour makes `TEXT_PRIMARY` hard to read. Pure white and
    black on purpose: they are the only pair guaranteed to reach a 4.5:1
    contrast ratio on *every* background. */
export const INK_LIGHT = "#ffffff";
export const INK_DARK = "#000000";

/** The opacity of a card's colour wash, mirroring `--card-tint` in
    `CardItem.module.css`. */
export const CARD_TINT_ALPHA = 0.45;
