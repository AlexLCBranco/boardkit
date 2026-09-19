import { flushSync } from "react-dom";
import { toast } from "sonner";

import { MAX_CARDS_PER_LIST } from "../../domain/limits";
import type { CardId } from "../../domain/types";
import { useBoardStore } from "../../store/boardStore";
import { useSelectionStore } from "../../store/selectionStore";
import { useShortcutsDialogStore } from "../../store/shortcutsDialogStore";
import {
  cardElement,
  focusCard,
  focusListHeader,
  listUnderPointer,
  type FocusTarget,
} from "./dom";
import { comboMatches, comboSignature, parseCombo, type Combo } from "./keys";
import {
  focusCardAbove,
  focusCardBelow,
  focusCardBeside,
  focusFirstCard,
  focusListBeside,
} from "./navigation";

/**
 * Every keyboard shortcut in the app, in one list.
 *
 * To add one: write one entry in `SHORTCUTS` below with a `card(...)`,
 * `list(...)` or `global(...)` helper. Nothing else needs touching -- the
 * single listener in `useShortcuts.ts` finds it, the clash check below covers
 * it, and the help dialog draws it.
 *
 * Scopes decide when an entry may fire:
 *  - `global`: any time, wherever focus is.
 *  - `card`: only while a card itself has focus.
 *  - `list`: only while a list's header has focus.
 * The same key can mean different things in different scopes ("d" only means
 * anything on a list); inside one scope a key may be used once.
 */

export type Scope = FocusTarget["scope"];

export interface Shortcut {
  readonly id: string;
  readonly scope: Scope;
  /** Alternatives that all do the same thing, e.g. `["e", "f2"]`. */
  readonly combos: readonly Combo[];
  readonly label: string;
  /** Fires even while a text field has focus. Off by default: a plain letter
      must never be stolen from someone typing. */
  readonly whileTyping: boolean;
  /** Holding the key fires again. Off by default, so holding Delete cannot
      chew through a list; focus movement turns it on. */
  readonly allowRepeat: boolean;
  /** An extra condition. While it is false the entry is skipped entirely, so
      the browser's own behaviour for that key (copy, paste) still happens. */
  readonly when?: () => boolean;
  readonly run: (target: FocusTarget) => void;
}

interface Options {
  readonly whileTyping?: boolean;
  readonly allowRepeat?: boolean;
  readonly when?: () => boolean;
}

function define(
  scope: Scope,
  id: string,
  keys: string | readonly string[],
  label: string,
  run: (target: FocusTarget) => void,
  options: Options = {},
): Shortcut {
  return {
    id,
    scope,
    combos: (typeof keys === "string" ? [keys] : keys).map(parseCombo),
    label,
    whileTyping: options.whileTyping ?? false,
    allowRepeat: options.allowRepeat ?? false,
    when: options.when,
    run,
  };
}

type CardTarget = Extract<FocusTarget, { scope: "card" }>;
type ListTarget = Extract<FocusTarget, { scope: "list" }>;

// The dispatcher only calls a `card` entry with a card target, and a `list`
// entry with a list target; these helpers are where that guarantee is
// turned into the narrower type, once, instead of at every entry.
const global = (id: string, keys: string | readonly string[], label: string, run: () => void, options?: Options) =>
  define("global", id, keys, label, run, options);
const card = (id: string, keys: string | readonly string[], label: string, run: (target: CardTarget) => void, options?: Options) =>
  define("card", id, keys, label, (target) => run(target as CardTarget), options);
const list = (id: string, keys: string | readonly string[], label: string, run: (target: ListTarget) => void, options?: Options) =>
  define("list", id, keys, label, (target) => run(target as ListTarget), options);

const board = () => useBoardStore.getState();
const selection = () => useSelectionStore.getState();
const hasSelectedText = () => Boolean(window.getSelection()?.toString());

export const SHORTCUTS: readonly Shortcut[] = [
  // --- Global ---------------------------------------------------------------
  global("history.undo", "mod+z", "Undo the last board change", () => board().undo(), {
    when: () => board().history.past.length > 0,
  }),
  global("history.redo", "mod+shift+z", "Redo", () => board().redo(), {
    when: () => board().history.future.length > 0,
  }),
  global("selection.copy", "mod+c", "Copy the selected cards", () => selection().copySelection(), {
    // With text highlighted, that Ctrl+C belongs to the browser.
    when: () => Object.keys(selection().selected).length > 0 && !hasSelectedText(),
  }),
  global(
    "selection.paste",
    "mod+v",
    "Paste copied cards into the list under the pointer",
    () => {
      const listId = listUnderPointer();
      if (listId) selection().pasteInto(listId);
    },
    { when: () => selection().clipboard.length > 0 && listUnderPointer() !== null },
  ),
  // Two steps: the selection first, then the copied cards (which are what
  // keeps the per-list paste buttons on screen).
  global(
    "selection.clear",
    "escape",
    "Clear the selection, then the copied cards",
    () => {
      if (Object.keys(selection().selected).length > 0) selection().clearSelection();
      else selection().clearClipboard();
    },
    { when: () => Object.keys(selection().selected).length > 0 || selection().clipboard.length > 0 },
  ),
  global("help.open", "?", "Show keyboard shortcuts", () => useShortcutsDialogStore.getState().setOpen(true)),

  // --- Card -----------------------------------------------------------------
  card("card.focus-up", "arrowup", "Focus the card above (from the first card: its list)", ({ cardId, listId }) => focusCardAbove(cardId, listId), { allowRepeat: true }),
  card("card.focus-down", "arrowdown", "Focus the card below", ({ cardId, listId }) => focusCardBelow(cardId, listId), { allowRepeat: true }),
  card("card.focus-left", "arrowleft", "Focus the nearest card in the list to the left", ({ cardId, listId }) => focusCardBeside(cardId, listId, -1), { allowRepeat: true }),
  card("card.focus-right", "arrowright", "Focus the nearest card in the list to the right", ({ cardId, listId }) => focusCardBeside(cardId, listId, 1), { allowRepeat: true }),
  card("card.new-below", "n", "New card directly below", (target) => addCardNextTo(target, 1)),
  card("card.new-above", "shift+n", "New card directly above", (target) => addCardNextTo(target, 0)),
  card("card.rename", ["e", "f2"], "Rename the card", ({ cardId }) => startRename(cardId)),
  // The card's own toggle button is the one place that knows how thots
  // open and close (it is local state in `CardItem`), so this presses it.
  card("card.toggle-thots", "t", "Open or close its thots", ({ cardId }) =>
    cardElement(cardId)?.querySelector<HTMLElement>("[data-thots-toggle]")?.click(),
  ),
  card("card.delete", "delete", "Send the card to the trash (undoable)", ({ cardId, listId }) => {
    // Hand focus to a neighbour first, so repeated presses walk down a list
    // instead of dropping focus onto the page.
    const ids = board().cardOrder[listId];
    const at = ids.indexOf(cardId);
    const neighbour = ids[at + 1] ?? ids[at - 1];
    if (neighbour) focusCard(neighbour);
    else focusListHeader(listId);
    board().deleteCard(listId, cardId);
  }),

  // --- List -----------------------------------------------------------------
  list("list.focus-left", "arrowleft", "Focus the list to the left", ({ listId }) => focusListBeside(listId, -1), { allowRepeat: true }),
  list("list.focus-right", "arrowright", "Focus the list to the right", ({ listId }) => focusListBeside(listId, 1), { allowRepeat: true }),
  list("list.focus-cards", "arrowdown", "Focus the list's first card", ({ listId }) => focusFirstCard(listId)),
  list("list.duplicate", "d", "Duplicate the list", ({ listId }) => board().duplicateList(listId)),
];

/** A new card next to the focused one, opened straight into rename. */
function addCardNextTo({ cardId, listId }: CardTarget, offset: 0 | 1): void {
  const index = board().cardOrder[listId].indexOf(cardId) + offset;
  // `flushSync` renders the new card before the next line runs: its title
  // button has to exist to be pressed, and React would otherwise draw it a
  // moment later.
  const newId = flushSync(() => board().addCardAt(listId, index, "New card"));
  if (newId === null) {
    toast.error(`List is full · ${MAX_CARDS_PER_LIST} cards max`);
    return;
  }
  startRename(newId);
}

/** Opens a card's title for editing, the same as clicking it. */
function startRename(cardId: CardId): void {
  cardElement(cardId)?.querySelector<HTMLElement>("[data-card-title] button")?.click();
}

/** The first entry that applies to this key press, or `undefined`. A narrower
    scope wins over `global`, so a card-only key can shadow a global one. */
export function findShortcut(
  event: KeyboardEvent,
  scope: Scope,
  isTyping: boolean,
): Shortcut | undefined {
  const scopes: readonly Scope[] = scope === "global" ? ["global"] : [scope, "global"];
  for (const candidate of scopes) {
    const match = SHORTCUTS.find(
      (shortcut) =>
        shortcut.scope === candidate &&
        (shortcut.whileTyping || !isTyping) &&
        (shortcut.allowRepeat || !event.repeat) &&
        shortcut.combos.some((combo) => comboMatches(combo, event)) &&
        (shortcut.when?.() ?? true),
    );
    if (match) {
      return match;
    }
  }
  return undefined;
}

/**
 * Two entries in the same scope on the same keys would make one of them
 * silently dead. Reports each such pair, so a mistake shows up the moment the
 * app loads rather than as a shortcut that "sometimes" works.
 */
export function findClashes(shortcuts: readonly Shortcut[]): string[] {
  const seen = new Map<string, string>();
  const clashes: string[] = [];
  for (const shortcut of shortcuts) {
    for (const combo of shortcut.combos) {
      const key = `${shortcut.scope}:${comboSignature(combo)}`;
      const other = seen.get(key);
      if (other !== undefined) {
        clashes.push(`"${other}" and "${shortcut.id}" both use ${comboSignature(combo)} in the ${shortcut.scope} scope`);
      } else {
        seen.set(key, shortcut.id);
      }
    }
  }
  return clashes;
}

if (import.meta.env.DEV) {
  for (const clash of findClashes(SHORTCUTS)) {
    console.error(`Shortcut clash: ${clash}`);
  }
}
