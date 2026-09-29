# Boardkit — project summary

_Last updated: 2026-09-29, v0.0.67_

## What it is

A fast, visual board app in the browser: lists of cards you drag around,
rename instantly, and style per list and per card. Not a project-management
tool or a Trello clone. Trello is the benchmark for drag feel only. Built by
the owner, who is learning frontend, with Claude Code and Codex. Repo:
github.com/AlexLCBranco/boardkit; every push to main deploys on Vercel.
Priorities: drag-and-drop, animation, instant editing, clean code. What
matters most: colours, the two text fields per card ("pregame" and
"postgame thots"), and drag smoothness. Out of scope: accounts, teams,
comments, due dates, notifications, integrations, AI, collaboration.

## Stack

Vite, React 19, TypeScript (strict), Zustand, dnd-kit, CSS Modules + design
tokens for the board, Tailwind v4 + shadcn/ui for menus and dialogs. No
backend: everything is saved in the browser (localStorage, IndexedDB for
images). Layered `app -> features -> components -> store -> domain`, with
normalised state.

## What works now

- Lists and cards: add, rename, delete, inline editing
- Drag cards within and between lists, and drag whole lists; one drag is
  one undo step, and Esc puts the card back
- Colours, icons, custom colours and highlight borders per list and per card
- Undo/redo, auto-save, backup reminder plus automatic folder backup
- Multiple boards: switcher, new board from a layout, move/copy cards to
  another board
- Search across all boards (Ctrl/Cmd+K), keyboard shortcuts
- Divider and note cards; clickable links in the thots
- Light/dark/system theme; per-board background colour or image
- Card numbering that can continue across lists, be styled, or be hidden
- Multi-select cards with a selection bar
- Collapse a list to a thin strip; cards can still be dropped on it
- A damaged saved board is repaired, its original kept aside, and a notice
  offers restoring it from the latest backup

## What's next

- More tests for the pure logic in `domain/` (the drag logic has them)

## Open problems

- Unused shadcn components need clearing out (low priority)
