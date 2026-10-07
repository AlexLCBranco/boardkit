import { create } from "zustand";

import type { MergeConflict } from "../domain/merge";

/**
 * What the user should hear about another tab's saves: an item both tabs
 * changed, where the other tab's version was kept (`domain/merge.ts`), an
 * undo or redo refused because its item was changed elsewhere since
 * (`domain/history.ts`), or the open board deleted in another tab.
 * `features/board/SyncToasts.tsx` shows each message once. Never saved,
 * never undoable.
 */
interface SyncNotice {
  /** The latest message; `seq` tells a repeat of the same text apart. */
  readonly message: { readonly seq: number; readonly text: string } | null;
  readonly conflicted: (conflicts: readonly MergeConflict[]) => void;
  readonly refused: (conflicts: readonly MergeConflict[], action: "undo" | "redo", linked: boolean) => void;
  readonly boardDeleted: (name: string) => void;
}

const quoted = (title: string) => `“${title}”`;

const nameOf = (conflict: MergeConflict) => (conflict.kind === "background" ? conflict.title : quoted(conflict.title));

/** "“Rent” was just changed in another tab, so that version was kept." */
export function conflictText(conflicts: readonly MergeConflict[]): string {
  const [first] = conflicts;
  const name = nameOf(first);
  if (conflicts.length === 1) {
    return `${name} was just changed in another tab, so that version was kept.`;
  }
  const more = conflicts.length - 1;
  return `${name} and ${more} more ${more === 1 ? "item were" : "items were"} just changed in another tab, so those versions were kept.`;
}

/** "Can't undo further: “Rent” was changed in another tab." A board linked
    to a Linkkit map may have been changed there instead; which one can't
    be told apart. */
export function refusedText(conflicts: readonly MergeConflict[], action: "undo" | "redo", linked: boolean): string {
  const where = linked ? "in Linkkit or another tab" : "in another tab";
  return `Can't ${action} further: ${nameOf(conflicts[0])} was changed ${where}.`;
}

export const useSyncNotice = create<SyncNotice>((set, get) => {
  const say = (text: string) => set({ message: { seq: (get().message?.seq ?? 0) + 1, text } });
  return {
    message: null,
    conflicted: (conflicts) => {
      if (conflicts.length > 0) say(conflictText(conflicts));
    },
    refused: (conflicts, action, linked) => say(refusedText(conflicts, action, linked)),
    boardDeleted: (name) => say(`${quoted(name)} was deleted in another tab.`),
  };
});
