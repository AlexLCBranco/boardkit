# Plan: move or copy a card or list to another board

A small, self-contained plan for one feature. It is **not** part of
`PLAN.md`'s queue; the owner will start it in a fresh chat. Written
2026-09-19.

## Why

Boards are made regularly (a new one each week), and cards carry over:
something unfinished on this week's board belongs on next week's. Today the
only way is to retype it. The same is true for a whole list. Other local board
apps get asked for exactly this ([Kanri #745](https://github.com/kanriapp/kanri/issues/745),
[Nullboard #11](https://github.com/apankrat/nullboard/issues/11)).

## What the user gets

- **A card:** "Move to board ›" and "Copy to board ›". Pick a board, then a
  list on that board. The card lands at the bottom of that list.
- **A list:** "Move to board ›" and "Copy to board ›" in the list header's
  right-click menu, next to "Duplicate list". Pick a board. The list,
  its colour, icon, width and all its cards land at the right-hand end of
  that board.
- The user stays on the board they're on. A short confirmation says where
  the card or list went ("Moved to *Week 39* → *To do*").
- Everything a card carries goes with it: title, colour, both thots.

## Before starting: ask the owner

1. **Where does the card's menu live?** Right-clicking a card already toggles
   its thots, so it can't also open a menu. Suggested default: one more small
   icon button in the card's hover row, next to "Customise card" and
   "Delete card", that opens a dropdown. Confirm or pick another spot.
2. **Undo after a move** (see "Decisions" below). Confirm the proposed
   behaviour is acceptable.

## How it works (the important parts)

**The other board isn't in memory.** Only the active board lives in the
Zustand store; every other board is a JSON document in `localStorage` under
`boardkit:board:<id>` (`src/store/persistBoard.ts`), and the registry
(`src/store/persistRegistry.ts`) only knows each board's id and name. So:

1. `flushPersist()` first. The save debounce is a single shared timer; if the
   user switched away from the target board less than 400ms ago, its latest
   edits are still pending and would be lost or overwritten.
2. Load the target with `loadPersistedBoard(targetId)`.
3. **If that returns `null`, stop and show an error. Never write.** `null`
   means the saved board is missing or failed validation. Writing a fresh
   board over it would destroy whatever is there (see `PLAN.md` item 5).
4. Apply a pure domain function to the loaded target (below).
5. Write it back straight away with `savePersistedBoardNow(...)`.
6. For a *move*, remove the card or list from the active board through the
   normal store action (see Decisions).

**Pure domain functions,** in a new `src/domain/transfer.ts` (no React, no
store, same style as `duplicate.ts`):

- `insertCardCopy(target, card, listId)` → the target board with a copy of
  the card, under a **fresh id**, appended to `cardOrder[listId]`. Returns
  `null` if that list is full (`isListFull` from `domain/limits.ts`) or is
  not on the target board.
- `insertListCopy(target, list, cards)` → the target board with a copy of
  the list and its cards, all under **fresh ids**, appended to `listOrder`.
  Reuse or factor out the copying logic in `duplicate.ts` instead of writing
  it a second time.

Fresh ids matter: copying the same card twice, or moving it back and forth,
must never produce two records with the same id.

**The 50-card limit applies.** In the list picker, a full list is shown
greyed out with "(full)". The domain function refuses it too, as a second
guard.

## Decisions

- **Move = copy to the target, then send the original to the trash** (via the
  existing `deleteCard` / `deleteList` actions). This keeps undo honest and
  simple: Ctrl+Z only ever affects the board you're on. Undoing a move brings
  the original back here, and the copy stays on the other board. That's a
  harmless duplicate the user can see and delete, instead of a cross-board
  undo system, which would be a lot of machinery for little gain. The
  trashed original ages out of the trash normally.
- **Copy** touches only the target board. The active board's history
  doesn't change.
- **The board being viewed isn't offered as a target.** Moving within a
  board is what drag-and-drop is for.
- **If there's only one board,** show the menu items disabled with a hint
  ("Make another board first") rather than hiding them, so the feature can
  be found.
- **Menus are supporting chrome:** shadcn `ContextMenuSub` (list header) and
  `DropdownMenu` + `DropdownMenuSub` (card button), with Tailwind. Not board-
  engine CSS Modules. `src/components/ui/sonner.tsx` exists for the
  confirmation, but its `<Toaster />` isn't mounted anywhere yet. Mount it
  once in `App.tsx`, or use a simpler inline message if that pulls in too
  much.
- **The target board's list names are read when the submenu opens,** not
  kept in the store. A board is small (at most 50 cards per list), so
  loading it on demand costs nothing noticeable.

## Out of scope

- Moving several selected cards at once.
- Dragging a card onto another board (e.g. dropping it on the board
  switcher). Nice, but a separate piece of work.
- Undo that spans boards.

## Done when

- A card and a list can each be moved and copied to another board, and show
  up there with all their content after switching to that board.
- A move sends the original to the trash on the source board, and Ctrl+Z
  restores it.
- A full target list can't be chosen.
- A target board that fails to load is never overwritten, and an error is
  shown.
- `npm run build` passes; checked in the browser, including right after
  switching boards (the 400ms save window).
- `ARCHITECTURE.md` has an entry; `package.json` patch version bumped;
  one commit on `main`.
- Before starting, claim it in `PLAN.md`'s "In flight" table so Codex
  doesn't start on the same files.
