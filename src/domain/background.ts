/**
 * Board backgrounds: cleaning what comes back from storage, and the CSS and
 * text colours a background implies. Pure and React-free, like the rest of
 * `domain/`.
 */

import type { ThemeName } from "../styles/surfaces";
import { accentCss, chromeOnColor, knownColor, parseHex, washedColor, type Chrome } from "./colors";
import type { BoardBackground, HexColor, ImageId } from "./types";

/** Stands in for an image's average colour when the saved one is unreadable. */
const NEUTRAL_AVERAGE = "#808080" as HexColor;

/** The strongest wash: even fully washed, a hint of the picture still shows. */
export const MAX_WASH = 0.9;
/** What a freshly chosen image starts with: the lists read comfortably. */
export const DEFAULT_WASH = 0.4;

export function clampWash(value: number): number {
  return Math.min(MAX_WASH, Math.max(0, value));
}

/** Image ids are nanoid strings; anything else is not one of ours, and is
    kept out of the key an IndexedDB lookup is made with. */
function isImageId(value: unknown): value is ImageId {
  return typeof value === "string" && /^[\w-]{1,64}$/.test(value);
}

/**
 * A background from storage that this build understands, or `undefined` for
 * anything else -- a kind from a newer version, a colour that is not one, or
 * a hand-edited backup. It degrades to "no background"; it never fails the
 * load of the board it belongs to.
 */
export function knownBackground(value: unknown): BoardBackground | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.kind === "color") {
    const color = knownColor(candidate.color);
    return color === undefined ? undefined : { kind: "color", color };
  }
  if (candidate.kind === "image" && isImageId(candidate.imageId)) {
    const wash = typeof candidate.wash === "number" && Number.isFinite(candidate.wash) ? candidate.wash : DEFAULT_WASH;
    // A missing or bad average only costs the toolbar its exact tuning, so it
    // falls back to a mid grey instead of dropping the image.
    const average = typeof candidate.average === "string" ? parseHex(candidate.average) : null;
    return {
      kind: "image",
      imageId: candidate.imageId,
      wash: clampWash(wash),
      average: average ?? NEUTRAL_AVERAGE,
    };
  }
  return undefined;
}

/** The value of the canvas's `--board-background` custom property, for a
    colour background. */
export function backgroundCss(background: Extract<BoardBackground, { kind: "color" }>): string {
  return accentCss(background.color);
}

/** The image a background points at, if it is one. */
export function imageIdOf(background: BoardBackground | undefined): ImageId | undefined {
  return background?.kind === "image" ? background.imageId : undefined;
}

/**
 * How the toolbar and "Add a list" should be drawn to stay readable on
 * `background`. With none, `undefined`: they simply follow the app's theme.
 */
export function chromeOnBackground(
  background: BoardBackground | undefined,
  theme: ThemeName,
): Chrome | undefined {
  if (background === undefined) {
    return undefined;
  }
  return chromeOnColor(
    background.kind === "color" ? background.color : washedColor(background.average, background.wash, theme),
    theme,
  );
}
