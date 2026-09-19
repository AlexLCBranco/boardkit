/**
 * The theme vocabulary. Pure and React-free, like the rest of `domain/`.
 *
 * A *choice* is what the user picks (Dark, Light, or System); a *theme* is
 * what is actually drawn. "System" is the only choice that needs the outside
 * world (the computer's setting), which is why `resolveTheme` takes it as an
 * argument instead of reading it.
 */

import type { ThemeName } from "../styles/surfaces";

export const THEME_CHOICES = ["dark", "light", "system"] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

export type { ThemeName };

/** Shown in the theme menu. */
export const THEME_LABELS: Readonly<Record<ThemeChoice, string>> = {
  dark: "Dark",
  light: "Light",
  system: "System",
};

/** Dark is the default: it is what the app looked like before themes. */
export const DEFAULT_THEME_CHOICE: ThemeChoice = "dark";

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return THEME_CHOICES.some((known) => known === value);
}

export function resolveTheme(choice: ThemeChoice, systemPrefersDark: boolean): ThemeName {
  if (choice === "system") {
    return systemPrefersDark ? "dark" : "light";
  }
  return choice;
}
