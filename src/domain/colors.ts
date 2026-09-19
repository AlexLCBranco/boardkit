/**
 * Everything about colours that isn't drawing: parsing what a user typed,
 * cleaning what comes back from storage, turning a colour into CSS, and
 * deciding which text colour stays readable on it. Pure and React-free, like
 * the rest of `domain/`.
 */

import {
  CARD_TINT_ALPHA,
  INK_DARK,
  INK_LIGHT,
  SURFACE_RAISED,
  TEXT_PRIMARY,
} from "../styles/surfaces";
import { PALETTE_COLORS, type HexColor, type ItemColor, type PaletteColor } from "./types";

/** WCAG AA for normal-size text is 4.5:1. The extra 0.1 absorbs the browser
    rounding the painted colour to whole channel values. */
const MIN_CONTRAST = 4.6;

/** How many custom colours the picker remembers. */
export const RECENT_COLOR_LIMIT = 8;

// ---- Parsing ----------------------------------------------------------

/**
 * A hex colour from whatever the user typed: 3 or 6 digits, with or without
 * the `#`, any case. Returns the normalised `#rrggbb`, or `null` for anything
 * else -- the caller shows an error rather than silently ignoring it.
 */
export function parseHex(input: string): HexColor | null {
  const digits = input.trim().replace(/^#/, "");
  if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(digits)) {
    return null;
  }
  const full =
    digits.length === 3
      ? digits
          .split("")
          .map((digit) => digit + digit)
          .join("")
      : digits;
  return `#${full.toLowerCase()}` as HexColor;
}

export function isPaletteColor(value: unknown): value is PaletteColor {
  return PALETTE_COLORS.some((known) => known === value);
}

export function isHexColor(color: ItemColor): color is HexColor {
  return color.startsWith("#");
}

/**
 * A colour from storage that this build understands, or `undefined` for
 * anything else. A malformed or unknown colour degrades to "no colour"; it
 * never fails the load.
 */
export function knownColor(value: unknown): ItemColor | undefined {
  if (isPaletteColor(value)) {
    return value;
  }
  return typeof value === "string" ? (parseHex(value) ?? undefined) : undefined;
}

/**
 * Cleans the `color` of every freshly loaded list or card. Returns the same
 * object when nothing needs changing, which is almost every board.
 */
export function withKnownColors<Id extends string, T extends { readonly color?: ItemColor }>(
  items: Readonly<Record<Id, T>>,
): Readonly<Record<Id, T>> {
  const ids = Object.keys(items) as Id[];
  const isClean = (item: T) => item.color === undefined || knownColor(item.color) === item.color;
  if (ids.every((id) => isClean(items[id]))) {
    return items;
  }
  const cleaned: Record<Id, T> = { ...items };
  for (const id of ids) {
    if (!isClean(cleaned[id])) {
      const { color: unknown, ...rest } = cleaned[id];
      const color = knownColor(unknown);
      cleaned[id] = (color === undefined ? rest : { ...rest, color }) as T;
    }
  }
  return cleaned;
}

/** The value a `--card-accent` / `--list-accent` custom property takes. */
export function accentCss(color: ItemColor): string {
  return isHexColor(color) ? color : `var(--palette-${color})`;
}

/** `color` moved to the front of the recent list: no duplicates, capped. */
export function withRecentColor(recent: readonly HexColor[], color: HexColor): HexColor[] {
  return [color, ...recent.filter((existing) => existing !== color)].slice(0, RECENT_COLOR_LIMIT);
}

/** `color` taken out of the recent list. */
export function withoutRecentColor(recent: readonly HexColor[], color: HexColor): HexColor[] {
  return recent.filter((existing) => existing !== color);
}

// ---- Contrast ---------------------------------------------------------

type Rgb = readonly [number, number, number];

function toRgb(hex: string): Rgb {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** WCAG relative luminance of an sRGB colour. */
function luminance([red, green, blue]: Rgb): number {
  const linear = (channel: number) => {
    const scaled = channel / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

/** WCAG contrast ratio, 1 (identical) to 21 (black on white). */
export function contrastRatio(first: Rgb, second: Rgb): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * The composited result of `overlay` at `alpha` over an opaque `base` -- what
 * a card's translucent colour wash actually looks like once painted.
 */
export function blend(overlay: Rgb, alpha: number, base: Rgb): Rgb {
  return overlay.map((channel, index) =>
    Math.round(channel * alpha + base[index] * (1 - alpha)),
  ) as unknown as Rgb;
}

/** Which text colour a card should use: the theme's own, or a forced one. */
export type InkTone = "default" | "light" | "dark";

/**
 * The text colour that stays readable on a card washed with `accent`.
 *
 * Palette colours (and no colour at all) always keep the theme's text: each
 * palette swatch was checked against it when the palette was chosen. A custom
 * colour can be anything, so its actual background -- the wash blended over
 * the card surface -- is measured, and text is switched to white or black
 * when the theme's fails 4.5:1. White and black between them reach at least
 * 4.58:1 on every possible background, so a card is always readable.
 */
export function cardInk(accent: ItemColor | undefined): InkTone {
  if (accent === undefined || !isHexColor(accent)) {
    return "default";
  }
  const background = blend(toRgb(accent), CARD_TINT_ALPHA, toRgb(SURFACE_RAISED));
  if (contrastRatio(toRgb(TEXT_PRIMARY), background) >= MIN_CONTRAST) {
    return "default";
  }
  return contrastRatio(toRgb(INK_LIGHT), background) >= contrastRatio(toRgb(INK_DARK), background)
    ? "light"
    : "dark";
}
