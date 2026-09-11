import { create } from "zustand";

import { createSeedBoard } from "../domain/seed";
import type { BoardState } from "../domain/types";

/**
 * The board store.
 *
 * Zustand rather than React Context: Context re-renders *every* consumer
 * whenever its value changes, which on a board with hundreds of cards means a
 * single rename repaints everything. Zustand subscribes per selector, so a
 * component only re-renders when the slice it actually read changes.
 *
 * The store holds the `BoardState` shape from the domain layer unchanged.
 * Mutations arrive in milestone 3; until then this is a read-only source of
 * truth, which is enough to prove the shape renders well.
 */
export type BoardStore = BoardState;

export const useBoardStore = create<BoardStore>(() => createSeedBoard());
