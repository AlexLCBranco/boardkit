# Boardkit — project summary

_Last updated: 2026-10-06, v0.0.78_

## What it is

A fast, visual board app in the browser: lists of cards you drag around,
rename instantly, and style per list and per card. Not a project-management
tool or a Trello clone. Trello is the benchmark for drag feel only. Built by
the owner, who is learning frontend, with Claude Code and Codex. Repo:
github.com/AlexLCBranco/boardkit; every push to main deploys on Vercel, at
its own address and, once the gauntlet site forwards it, at /boardkit there.
Priorities: drag-and-drop, animation, instant editing, clean code. What
matters most: colours, the two text fields per card ("pregame" and
"postgame thots"), and drag smoothness. Out of scope: accounts, teams,
comments, due dates, notifications, integrations, AI, collaboration.

## Stack

Vite, React 19, TypeScript (strict), Zustand, dnd-kit, CSS Modules + design
tokens for the board, Tailwind v4 + shadcn/ui for menus and dialogs. No
backend: everything is saved in the browser (localStorage, IndexedDB for
images); every key and database is named "boardkit…" so other apps on the
shared gauntlet site can sit beside it. Layered
`app -> features -> components -> store -> domain`, with
normalised state.

## What works now

- Lists and cards: add, rename, delete, inline editing
- Drag cards within and between lists, and drag whole lists; one drag is
  one undo step, and Esc puts the card back
- Colours, icons, custom colours and highlight borders per list and per card
- Undo/redo, auto-save, backup reminder plus automatic folder backup
- Saves are written immediately when the page is hidden or reloaded,
  including text still being typed into an open field
- Multiple boards: switcher, new board from a layout, move/copy cards to
  another board
- Search across all boards (Ctrl/Cmd+K), keyboard shortcuts
- Divider and note cards; clickable links in the thots
- Light/dark/system theme; per-board background colour or image
- Card numbering that can continue across lists, be styled, or be hidden
- Multi-select cards with a selection bar
- Collapse a list to a thin strip; cards can still be dropped on it
- Deleted cards and lists go to the trash (up to 200 cards and 30 lists
  per board); when it is full, deleting asks first and names the oldest
  item it would erase for good, instead of erasing it silently
- When the browser’s storage is full and a save fails, a banner says
  changes aren’t being saved and stays until they are, with “Back up
  now”, “Empty trash…” (asks first) and “Try again” (retries every save
  that failed, boards that aren’t open included). Moving a card or
  list to a board that can’t be saved now fails with a message instead of
  trashing the original, and a background picture that can’t be stored
  says so
- A damaged saved board is repaired, its original kept aside, and a notice
  offers restoring it from the latest backup (named by date); add
  `?damage-test` to the address to try it on a throwaway board. Until it is
  answered, backups keep that board's last good version; others back up as usual
- Works under /boardkit (built for the shared gauntlet site) as well as at
  its own address
- A new address starts empty and offers "Restore all boards from a backup
  folder": the newest backup is loaded, every board and its pictures come
  back, and nothing already there is replaced

## What's next

- Gauntlet: a shared data store all apps use, then a canvas of live app
  pieces (not started)
- More tests for the pure logic in `domain/` (the drag logic has them)

## Open problems

- A board whose first save failed (storage full) and was never retried
  is still in the board list after a reload, but opens empty with no
  message: its content was lost with the tab. Not fixed yet
- Unused shadcn components need clearing out (low priority)
