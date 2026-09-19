import { create } from "zustand";

import {
  DEFAULT_THEME_CHOICE,
  isThemeChoice,
  resolveTheme,
  type ThemeChoice,
  type ThemeName,
} from "../domain/theme";

/**
 * The app's theme: Dark, Light, or System. Per browser, not per board, so it
 * sits in its own `localStorage` key and never enters a board's undo history.
 *
 * The store's job is to keep three things in step: the saved choice, the
 * `data-theme` attribute (and shadcn's `.dark` class) on `<html>` that the
 * stylesheet reads, and the resolved theme React components read. The
 * attribute is first set by a small script in `index.html`, before the app's
 * code has even loaded, so the page never flashes the wrong theme; this store
 * only takes over from there. If that script's key or logic changes, change
 * it there too.
 */
const STORAGE_KEY = "boardkit:theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function loadChoice(): ThemeChoice {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return isThemeChoice(saved) ? saved : DEFAULT_THEME_CHOICE;
  } catch {
    return DEFAULT_THEME_CHOICE;
  }
}

function systemPrefersDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

/** Writes the resolved theme where the stylesheet and shadcn look for it. */
function applyToDocument(theme: ThemeName): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.toggle("dark", theme === "dark");
}

interface ThemeState {
  readonly choice: ThemeChoice;
  readonly resolved: ThemeName;
  readonly setChoice: (choice: ThemeChoice) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const choice = loadChoice();
  const resolved = resolveTheme(choice, systemPrefersDark());
  applyToDocument(resolved);

  // "System" follows the computer live: changing the OS setting while the app
  // is open switches it at once. Ignored for an explicit Dark or Light.
  window.matchMedia(DARK_QUERY).addEventListener("change", (event) => {
    if (get().choice === "system") {
      const next = resolveTheme("system", event.matches);
      applyToDocument(next);
      set({ resolved: next });
    }
  });

  return {
    choice,
    resolved,
    setChoice: (next) => {
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Private browsing: the choice lasts until the page is closed.
      }
      const nextResolved = resolveTheme(next, systemPrefersDark());
      applyToDocument(nextResolved);
      set({ choice: next, resolved: nextResolved });
    },
  };
});

export const useThemeChoice = () => useThemeStore((state) => state.choice);
export const useResolvedTheme = () => useThemeStore((state) => state.resolved);
export const useSetThemeChoice = () => useThemeStore((state) => state.setChoice);
