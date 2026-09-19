/**
 * JS-side mirrors of the few colour tokens the contrast maths needs.
 *
 * Same reasoning as `motion.ts`: working out whether text is readable on a
 * user-picked colour happens in JS, which can't read a `var(...)`. Keep these
 * in sync with `tokens.css` by hand.
 */

/** The two looks the app has. "System" is a *choice* (domain/theme.ts); by
    the time anything is drawn it has resolved to one of these. */
export type ThemeName = "dark" | "light";

/** What a card is drawn from in one theme. */
export interface ThemeSurface {
  /** `--surface-raised`: what a card's tint is laid over. */
  readonly raised: string;
  /** `--text-primary`: the text colour a card uses unless told otherwise. */
  readonly text: string;
  /** `--text-secondary`: the dimmer text bare toolbar controls use. */
  readonly textSecondary: string;
}

/** Mirrors `:root` and `:root[data-theme="light"]` in `tokens.css`. */
export const THEME_SURFACES: Readonly<Record<ThemeName, ThemeSurface>> = {
  dark: { raised: "#1d2026", text: "#e8eaee", textSecondary: "#a3abb9" },
  light: { raised: "#ffffff", text: "#1a1d23", textSecondary: "#464e5c" },
};

/** `--palette-*`, by palette name. The palette is the same in both themes, so
    one table serves both. A board background can be a palette colour, and
    deciding what text reads on it happens in JS. */
export const PALETTE_HEX: Readonly<Record<string, string>> = {
  slate: "#667085",
  red: "#e03131",
  orange: "#e8590c",
  yellow: "#f0b000",
  green: "#2f9e44",
  teal: "#0ca678",
  blue: "#4c6ef5",
  purple: "#9c36b5",
};

/** `--ink-light` and `--ink-dark`: the two text colours a card can switch to
    when a custom colour makes the theme's text hard to read. Pure white and
    black on purpose: they are the only pair guaranteed to reach a 4.5:1
    contrast ratio on *every* background. Identical in both themes. */
export const INK_LIGHT = "#ffffff";
export const INK_DARK = "#000000";

/** The opacity of a card's colour wash, mirroring `--card-tint` in
    `CardItem.module.css`. The same in both themes: it was already the
    strongest wash that clears 4.5:1 on dark, and light text-on-tint has
    more headroom, not less (checked for every palette colour). */
export const CARD_TINT_ALPHA = 0.45;
