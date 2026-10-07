import { create } from "zustand";

import type { MergeConflict } from "../domain/merge";

/**
 * What the user should hear about another tab's saves: an item both tabs
 * changed, where the other tab's version was kept (`domain/merge.ts`), or
 * the open board deleted in another tab. `features/board/SyncToasts.tsx`
 * shows each message once. Never saved, never undoable.
 */
interface SyncNotice {
  /** The latest message; `seq` tells a repeat of the same text apart. */
  readonly message: { readonly seq: number; readonly text: string } | null;
  readonly conflicted: (conflicts: readonly MergeConflict[]) => void;
  readonly boardDeleted: (name: string) => void;
}

const quoted = (title: string) => `“${title}”`;

/** "“Rent” was just changed in another tab, so that version was kept." */
export function conflictText(conflicts: readonly MergeConflict[]): string {
  const [first] = conflicts;
  const name = first.kind === "background" ? first.title : quoted(first.title);
  if (conflicts.length === 1) {
    return `${name} was just changed in another tab, so that version was kept.`;
  }
  const more = conflicts.length - 1;
  return `${name} and ${more} more ${more === 1 ? "item were" : "items were"} just changed in another tab, so those versions were kept.`;
}

export const useSyncNotice = create<SyncNotice>((set, get) => {
  const say = (text: string) => set({ message: { seq: (get().message?.seq ?? 0) + 1, text } });
  return {
    message: null,
    conflicted: (conflicts) => {
      if (conflicts.length > 0) say(conflictText(conflicts));
    },
    boardDeleted: (name) => say(`${quoted(name)} was deleted in another tab.`),
  };
});
