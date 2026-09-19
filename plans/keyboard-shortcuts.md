# Plan: a keyboard shortcut system, plus the first batch of shortcuts

A self-contained plan for one feature. It is **not** part of `PLAN.md`'s
queue. Approved by the owner 2026-09-19 (see
[`feature-review.md`](./feature-review.md), #9).

## Why a system, not just shortcuts

The owner approved the proposed shortcuts and added: "I'll have an insane
amount of shortcuts at some point." So the priority is a structure where
adding the 30th or 60th shortcut is one line and can't break the others.

Today each shortcut is wired by hand: `useUndoRedoShortcuts.ts` has its own
`keydown` listener and its own "is the user typing?" check, and
`ShortcutsDialog.tsx` keeps a separate, hand-written list of what the keys
do. At scale, that means duplicate listeners, keys that silently clash, and
a help dialog that drifts out of date.

## Part 1: the system

- **One registry,** e.g. `src/features/shortcuts/registry.ts`: a list of
  entries like

  ```ts
  { id: "card.new-below", keys: "n", scope: "card", label: "New card below", run }
  ```

- **One `keydown` listener** for the whole app, which looks up the key in
  the registry. It replaces `useUndoRedoShortcuts.ts`'s own listener; undo
  and redo move into the registry as the first two entries.
- **Scopes:** `global` (works anywhere), `card` (needs a focused card),
  `list` (needs a focused list). The same key can mean different things in
  different scopes; within one scope, a duplicate key is a bug.
- **Clash check:** in development, log an error at startup if two entries
  in the same scope use the same keys. Mistakes show up immediately, not
  as a shortcut that "sometimes" works.
- **Typing is sacred:** single-letter shortcuts never fire while focus is
  in a text field (`INPUT`, `TEXTAREA`, contenteditable). Reuse
  `isEditableTarget` from `useUndoRedoShortcuts.ts`. Shortcuts with
  Ctrl/Cmd can opt in to firing while typing, entry by entry.
- **Don't fight the drag:** while a card or list is picked up with the
  keyboard (Space), arrow keys and Space belong to dnd-kit. The registry
  must stand aside during a keyboard drag.
- **Help dialog generated from the registry:** `ShortcutsDialog.tsx` renders
  the registry's entries, grouped by scope, instead of its hand-written
  list. Mouse-only actions that are listed there today (resize handle
  gestures, right-click actions) stay as a small separate "mouse" section.
- **Ctrl on Windows, Cmd on Mac,** shown correctly in the help dialog.
- **Not now:** letting the user remap keys, and a command palette. The
  registry makes both possible later (a palette is just "list registry
  entries and run one"), but neither was asked for. A command palette is on
  `PLAN.md`'s "Not being built" list.

## Part 2: the first shortcuts

| Key | Scope | Does |
|---|---|---|
| Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z | global | Undo / redo (moved from the old hook) |
| ↑ ↓ | card | Focus the card above / below |
| ← → | card | Focus the nearest card in the list to the left / right |
| N | card | New card directly below the focused one |
| Shift+N | card | New card directly above |
| E, F2 | card | Rename the focused card |
| T | card | Open / close its thots |
| Delete | card | Send it to the trash (undoable) |
| D | list | Duplicate the focused list |
| ? | global | Open the shortcuts dialog |

(Ctrl/Cmd+K for search belongs to [`search-all-boards.md`](./search-all-boards.md);
if that lands first, register it here.)

Notes:

- **Focus is visible:** a clear focus ring on the focused card/list, from
  `tokens.css`, shown for keyboard focus only (`:focus-visible`).
- **N / Shift+N** need a store action that inserts at a position (today
  `addCard` only appends). Add it as a pure function in
  `domain/ordering.ts`, respect the 50-card limit (`domain/limits.ts`), and
  open the new card straight into rename mode.
- **Arrow-key focus** moves DOM focus between existing sortable elements
  (they already have `data-card-id`); it doesn't pick anything up.

## Done when

- Every shortcut above works, is listed in the (generated) help dialog, and
  never fires while typing in a field.
- Undo/redo behave exactly as before.
- Keyboard dragging (Tab, Space, arrows, Space) works exactly as before.
- A deliberate duplicate key in the same scope produces a console error in
  development.
- Adding a new shortcut is one registry entry, described in
  `ARCHITECTURE.md`.
- `npm run build` passes; checked in the browser.
- `package.json` patch version bumped; one commit on `main` (or two: the
  system first, then the shortcuts).
- Before starting, claim it in `PLAN.md`'s "In flight" table so Codex
  doesn't start on the same files.
