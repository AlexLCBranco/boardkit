/**
 * Board backgrounds: cleaning what comes back from storage, and the CSS and
 * text colours a background implies. Pure and React-free, like the rest of
 * `domain/`.
 */

import type { ThemeName } from "../styles/surfaces";
import { accentCss, chromeOnColor, knownColor, type Chrome } from "./colors";
import type { BoardBackground } from "./types";

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
  return undefined;
}

/** The value of the canvas's `--board-background` custom property. */
export function backgroundCss(background: BoardBackground): string {
  return accentCss(background.color);
}

/**
 * How the toolbar and "Add a list" should be drawn to stay readable on
 * `background`. With none, `undefined`: they simply follow the app's theme.
 */
export function chromeOnBackground(
  background: BoardBackground | undefined,
  theme: ThemeName,
): Chrome | undefined {
  return background === undefined ? undefined : chromeOnColor(background.color, theme);
}
