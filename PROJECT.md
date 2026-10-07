# Boardkit — project summary

_Last updated: 2026-10-07, v0.0.88_

## What it is

A fast, visual board app in the browser: lists of cards you drag around,
rename instantly, and style per list and per card. Not a project-management
tool or a Trello clone. Trello is the benchmark for drag feel only. Built by
the owner, who is learning frontend, with Claude Code and Codex. Repo:
github.com/AlexLCBranco/boardkit; every push to main deploys on Vercel.
Its home is gauntlet-home.vercel.app/boardkit.
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
  that failed, boards that aren’t open included; switching boards meanwhile
  is safe, since a board whose save failed reopens with its real
  content). A new board joins the saved list only once its own content
  is stored, so a failed first save never leaves the list naming nothing.
  While the banner shows, closing or reloading the tab asks first (the
  browser’s “Leave site?” prompt; not on mobile Safari).
  Moving a card or
  list to a board that can’t be saved now fails with a message instead of
  trashing the original, and a background picture that can’t be stored
  says so
- A board in the list whose content isn’t in storage at all (its save
  failed and the tab closed before a retry) is named as Boardkit opens;
  opening it shows the recovery notice, offering to restore it from a
  backup or continue with it empty, instead of an unexplained empty board
- A damaged saved board is repaired, its original kept aside, and a notice
  offers restoring it from the latest backup (named by date); add
  `?damage-test` to the address to try it on a throwaway board. Until it is
  answered, backups keep that board's last good version; others back up as usual
- Saved boards are version 2, ready for sharing with Linkkit: lists and
  cards keep a keep / maybe / cut decision, and each save
  counts up a revision number. Older saves open as before. A board saved
  by a newer Boardkit (this tab was open across a deploy) opens
  read-only with a "Reload" notice, instead of being offered up as
  unreadable and continued empty
- Two tabs open at once no longer overwrite each other: a change saved in
  one tab shows in the other at once, and a save first takes in what the
  other tab stored, keeping both tabs' changes. When both changed the same
  card, list or background, the other tab's version stays and a message
  names it. A board deleted in one tab leaves the other (it switches to
  another board and says so)
- Undo keeps working after another tab's (or Linkkit's) change: an undo
  puts back only what its own step changed, keeping what came in. If that
  card, list or background was also changed elsewhere since, the undo is
  refused ("Can't undo further: “Rent” was changed in another tab", or
  "in Linkkit or another tab" for a board linked to a map) and older
  steps go; what was already undone can still be redone. (v0.0.87 fixed
  undoing a move of a card another tab had since erased, which left the
  board pointing at a missing card; found by the new random stress test)
- A card or list with a keep / maybe / cut decision (set in Linkkit)
  shows a small grey badge (✓, ?, ✂). A cut card, and every card in a cut
  list, fades with a dashed edge, its colours kept; hovering brings it back
- Deleting a board linked to a Linkkit map names the map in the question
  (Linkkit keeps its copy as an ordinary tree; one in Linkkit's trash is
  named too), and says the map's deleted boxes, kept in this board's
  trash, go with it
- Runs at gauntlet-home.vercel.app/boardkit and on localhost. Any other
  address (the old boardkit-iota.vercel.app) shows only a "This app moved"
  page: a button to the new address and "Export everything saved here",
  a backup file to restore there. Nothing saved at the old address is
  changed or cleared (v0.0.88)
- A new address starts empty and offers "Restore all boards from a backup
  folder": the newest backup is loaded, every board and its pictures come
  back, and nothing already there is replaced

## What's next

- Linking with Linkkit (steps 20-27 in Linkkit's PROJECT.md) is done:
  the last, step 27 (undo that survives another tab's or Linkkit's
  change), shipped in v0.0.86
- Gauntlet: a canvas of live app pieces (not started)

## Open problems

- Unused shadcn components need clearing out (low priority)
