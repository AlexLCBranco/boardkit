# Plan: start a new board from an existing board's layout

A small, self-contained plan for one feature. It is **not** part of
`PLAN.md`'s queue. Approved by the owner 2026-09-19 (see
[`feature-review.md`](./feature-review.md), #2).

## Why

Boards are made regularly (a new one each week) and usually have the same
lists every time. Today there are two ways to make a board, and neither
fits: "+ New board" is empty, and "Duplicate this board" copies every card,
which then have to be deleted one by one.

## What the user gets

A third item in the board switcher's dropdown
(`src/features/board/BoardSwitcher.tsx`), next to "Duplicate this board":
**"New board from these lists"**.

1. It opens the existing name dialog (`NewBoardDialog.tsx`), the same one
   "+ New board" uses, so the new board gets a proper name ("Week 40")
   instead of "(copy)".
2. The new board has every list currently on the board, in the same order,
   with its title, colour, icon and width, and **no cards**.
3. The app switches to the new board, as "+ New board" and "Duplicate" do.

This pairs with the [move-to-another-board](./move-to-another-board.md) plan:
make next week's board from this one's layout, then move over only the
unfinished cards.

## How it works

Model it on `duplicateBoard` in `src/store/boardStore.ts`, which already
does the storage bookkeeping correctly: `flushPersist()` first, then a new
board id, `savePersistedBoardNow`, `savePersistedRegistryNow`, and
`EMPTY_HISTORY`.

The one new piece is a pure function, e.g. `layoutOnly(state)` in
`src/domain/duplicate.ts` (no React, no store):

- `listOrder`: the same ids, in the same order.
- `lists`: **only** the lists in `listOrder`. `state.lists` also holds
  records for trashed lists (a trashed list keeps its record; only
  `listOrder` loses it), and those must not come along.
- `cardOrder`: an empty array for each of those lists.
- `cards`: `{}`.
- `trash` and `trashedLists`: empty.

List ids can be reused as-is: each board is its own storage document, and
`duplicateBoard` already shares ids across boards the same way. (The
move-to-another-board plan gives *copied* items fresh ids; that's a separate
concern.)

## Decisions

- **Name it via the dialog,** not an automatic "(copy)"/"(layout)" suffix.
  The last shipped change ("Ask for a name when creating a new board") set
  that expectation.
- **Board-level only.** No "which lists to include" picker. If a list isn't
  wanted, delete it on the new board.
- **Start from the board being viewed.** Picking a different source board
  is out of scope.

## Done when

- The new menu item creates a named board with the same lists (title,
  colour, icon, width, order), no cards, an empty trash, and switches to it.
- Trashed lists from the source board do not appear on the new one.
- The source board is unchanged, including right after an edit (the 400ms
  save window: check `flushPersist()` is called first).
- `npm run build` passes; checked in the browser.
- `ARCHITECTURE.md` has an entry; `package.json` patch version bumped;
  one commit on `main`.
- Before starting, claim it in `PLAN.md`'s "In flight" table so Codex
  doesn't start on the same files.
