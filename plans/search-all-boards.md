# Plan: search across all boards

A small, self-contained plan for one feature. It is **not** part of
`PLAN.md`'s queue. Approved by the owner 2026-09-19 (see
[`feature-review.md`](./feature-review.md), #3).

## Why

There's a new board every week. After a few weeks, "which board was that
card on?" means opening boards one at a time. Search answers it in one step.

## What the user gets

1. Press **Ctrl+K** (Cmd+K on Mac), or click a small search button in the
   board toolbar. A search box opens in the middle of the screen.
   - Not Ctrl+F: that's the browser's own find-in-page, and people expect it
     to keep working.
2. Type. Results appear as you type, across **every board**:

   > **Week 38** · To do · *Call dentist*
   > **Week 36** · Done · *Dentist invoice* — "…ask about the **dentist** bill…"

   - Card titles, pregame thots and postgame thots are all searched.
   - When the match is in a thot, the result shows a short snippet around
     the match so it's clear why the card turned up.
   - Results from the board being viewed come first, then other boards.
3. Arrow keys to pick a result, Enter to open it (or click). The app switches
   to that board if needed, scrolls the card into view and briefly highlights
   it.
4. Escape closes the search without doing anything.

## How it works

**UI:** shadcn's `CommandDialog` (`src/components/ui/command.tsx`, backed by
`cmdk`, both already installed). It's supporting chrome, so Tailwind and
shadcn, not board-engine CSS Modules. Turn off cmdk's built-in fuzzy
filtering (`shouldFilter={false}`) and pass in our own results, so matching
rules are ours and predictable.

**Matching** is a pure function in a new `src/domain/search.ts` (no React,
no store):

- Case-insensitive substring match on `title`, `description` (pregame) and
  `postgameDescription` (postgame).
- Only cards **on the board**: cards in `cardOrder` of lists in `listOrder`.
  Trashed cards and cards in trashed lists stay in `cards` (see
  `domain/trash.ts`) and must be skipped.
- Returns `{ boardId, boardName, listId, listTitle, cardId, field, snippet }`
  per hit.
- An empty query returns nothing, not everything.

**Where the data comes from:**
- The board being viewed: straight from the Zustand store, so unsaved edits
  are included.
- Every other board: `loadPersistedBoard(id)` from `src/store/persistBoard.ts`,
  for each board in the registry. Load them **once when the dialog opens**,
  not on every keystroke. With at most 50 cards per list, that's small.
- Call `flushPersist()` when the dialog opens. If the user switched boards
  less than 400ms ago, the board they left still has a pending save, and
  reading it from storage would miss those edits.
- A board that fails to load (`null`) is skipped silently. Search never
  writes anything.

**Opening a result on another board:** `switchBoard(boardId)`, then highlight
the card after the new board has rendered. The card element already has
`data-card-id`, so the highlight can find it without threading refs.

**The highlight:** a short fade in and out of an accent ring. Per the
animation rule, animate **opacity only**, on a pseudo-element or overlay
that already has the ring drawn. Don't animate `box-shadow` or `outline`.
Duration and colour come from `tokens.css`.

## Decisions

- **Search, not filter.** Nothing on the board is hidden or faded while
  typing. Filtering is a separate, bigger feature.
- **All boards by default.** No "this board only" toggle for now;
  current-board results sort first, which covers most of that need.
- **Shortcut:** Ctrl/Cmd+K plus a toolbar button. Add the shortcut to
  `ShortcutsDialog.tsx`'s list.
- **Don't open the card's thots automatically** when the match is in them.
  The snippet already shows the match; opening them changes the card's
  look, which the owner didn't ask for. Easy to add later if wanted.

## Housekeeping

`PLAN.md`'s "Not being built" section lists "search and filter" as
not-started-until-asked. The owner has now asked for **search**: when this
lands, change that line to leave only "filter".

## Done when

- Ctrl/Cmd+K and the toolbar button open search, and Escape closes it.
- Titles, pregame thots and postgame thots on every board are found; trashed
  cards are not.
- Picking a result on another board switches to it, scrolls to the card and
  highlights it (opacity-only animation, tokens only).
- An edit made less than 400ms before opening search is still found.
- `npm run build` passes; checked in the browser with at least two boards.
- `ARCHITECTURE.md` has an entry; `PLAN.md`'s "Not being built" line
  updated; `package.json` patch version bumped; one commit on `main`.
- Before starting, claim it in `PLAN.md`'s "In flight" table so Codex
  doesn't start on the same files.
