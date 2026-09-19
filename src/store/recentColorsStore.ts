import { create } from "zustand";

import { parseHex, withRecentColor } from "../domain/colors";
import type { HexColor } from "../domain/types";

/**
 * The custom colours picked lately, so a colour used once is one click the
 * next time. Per browser, not per board: a colour picked on one board is
 * there on all of them, so it sits in its own `localStorage` key rather than
 * in a board's saved content -- and, like the backup state, never enters a
 * board's undo history.
 */
const STORAGE_KEY = "boardkit:recentColors";

function loadRecent(): readonly HexColor[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) {
      return [];
    }
    // Re-validate rather than trust the stored strings, and let
    // `withRecentColor` apply the size cap and drop duplicates.
    return parsed
      .map((entry) => (typeof entry === "string" ? parseHex(entry) : null))
      .filter((color): color is HexColor => color !== null)
      .reduceRight<HexColor[]>((recent, color) => withRecentColor(recent, color), []);
  } catch {
    return [];
  }
}

interface RecentColorsState {
  /** Most recent first. */
  readonly recent: readonly HexColor[];
  readonly remember: (color: HexColor) => void;
}

export const useRecentColorsStore = create<RecentColorsState>((set, get) => ({
  recent: loadRecent(),

  remember: (color) => {
    const recent = withRecentColor(get().recent, color);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recent));
    } catch {
      // Quota or private browsing: the list just lives in memory this session.
    }
    set({ recent });
  },
}));
