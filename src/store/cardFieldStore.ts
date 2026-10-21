import { create } from "zustand";

import type { ListId } from "../domain/types";

/**
 * The list whose "Add a card" field should open now: a list just made with
 * "Add a list" and Enter, so its first card can be typed at once (owner,
 * 2026-10-21). The list's composer opens and clears this. Not saved, not
 * undoable.
 */
export const useCardFieldRequest = create<{ readonly listId: ListId | null }>(() => ({ listId: null }));
