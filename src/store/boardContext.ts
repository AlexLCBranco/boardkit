import { createContext, useContext } from "react";
import { useStore, type StoreApi } from "zustand";

import { useBoardStore, type BoardStore } from "./boardStore";

/**
 * Which board store the board UI reads. Boardkit itself never provides one,
 * so every component reads the app's own store (`useBoardStore`). The
 * gauntlet whiteboard shows several boards at once: each is drawn by these
 * same components under its own provider (a read-only store for a board
 * that isn't being edited; see `whiteboard/`).
 */
export const BoardStoreContext = createContext<StoreApi<BoardStore> | null>(null);

/** The board store in context itself, for reading it right after an action. */
export function useBoardApi(): StoreApi<BoardStore> {
  return useContext(BoardStoreContext) ?? useBoardStore;
}

/** `useBoardStore(selector)`, from the board store in context. */
export function useBoard<T>(selector: (state: BoardStore) => T): T {
  const store = useContext(BoardStoreContext) ?? useBoardStore;
  return useStore(store, selector);
}
