# Feature review: live summary

The owner is going through ten feature ideas one at a time. They came from
researching other board apps (Planka, Wekan, Focalboard, Obsidian Kanban,
Kanri, Nullboard, Tasks.md, Fizzy). Each decision is recorded here as it's
made; the ones approved get built later, in separate chats. Started
2026-09-19.

| # | Idea | Decision | Plan file |
|---|------|----------|-----------|
| 1 | Move or copy a card or list to another board | ✅ **Approved** | [`move-to-another-board.md`](./move-to-another-board.md) |
| 2 | Start a new board from an old one's layout (lists, no cards) | ✅ **Approved** | [`new-board-from-layout.md`](./new-board-from-layout.md) |
| 3 | Search across all boards | ✅ **Approved** | [`search-all-boards.md`](./search-all-boards.md) |
| 4 | Special card types, starting with dividers | ✅ **Approved, widened** | [`special-card-types.md`](./special-card-types.md) |
| 5 | Custom colours beyond the palette | ✅ **Approved, if glitch-free** | [`custom-colours.md`](./custom-colours.md) |
| 6 | Board backgrounds (colour + image) and a light theme | ✅ **Approved, all three** | [`backgrounds-and-themes.md`](./backgrounds-and-themes.md) |
| 7 | Collapse a whole list to a thin strip | ✅ **Approved, needs owner's changes** | [`collapse-list.md`](./collapse-list.md) |
| 8 | Clickable links in thots | ✅ **Approved** | [`clickable-links.md`](./clickable-links.md) |
| 9 | Keyboard shortcut system + first batch of shortcuts | ✅ **Approved, widened** | [`keyboard-shortcuts.md`](./keyboard-shortcuts.md) |
| 10 | Automatic backup to a folder + backup reminder | ✅ **Approved, both** | [`automatic-backup.md`](./automatic-backup.md) |

Two bigger ideas were raised and not numbered: phone/touch support and
swimlanes.

## Notes per decision

### 1. Move or copy to another board: approved

The owner was already going to ask for it once they had a second week's
board. Two questions to settle when it's built: where the card's menu goes
(right-click is taken by the thots toggle), and whether undo after a move
("the original comes back here, the copy stays there") is acceptable.

### 2. New board from an existing board's layout: approved

Approved as proposed, with no changes. It's a "New board from these lists"
item in the board switcher: it asks for a name, copies every list on the
board (title, colour, icon, width), copies no cards, and switches to the new
board. Pairs with #1: make next week's board from this layout, then move over
only the unfinished cards.

### 3. Search across all boards: approved

Approved: search card titles **and** both thots, across every board. It's a
search box (Ctrl/Cmd+K or a toolbar button) with live results as you type.
Picking one switches to that board and highlights the card. Search only, no
filter: nothing on the board is hidden while typing.

### 4. Divider cards → special card types: approved and widened

The owner wanted more than dividers: "special cards as a whole, types of
special cards". Plan: a card-type system with the **divider** as the first
type (a heading line across the list, unnumbered, no thots), built so that
adding more types later is small. Still to ask when it's built: which types
besides the divider (suggested: Note, Highlight), and whether special cards
count toward the 50-card limit (default: yes).

### 5. Custom colours: approved, on condition they don't glitch

The owner has seen custom colours glitch in Excalidraw, and approved only if
Boardkit avoids that. Excalidraw's reported problems: in dark mode, colours
don't match what was picked (it inverts the canvas with a filter); invalid
hex codes are silently ignored; the hex popover covers other menus. The plan
guards against each of these, plus two of our own: unreadable text on
extreme colours (auto light/dark text by contrast) and one picker drag
creating dozens of undo steps (commit once, on release). Recent custom
colours are remembered as extra swatches.

### 6. Backgrounds and themes: approved, all three parts

The owner wants all of it: a **light theme** (Dark / Light / System, for the
whole app), a **background colour** per board, and a **background image**
per board. Built as three commits in that order, after #5 (they reuse its
colour picker and readable-text check). Images are the tricky part: browser
storage for boards is only about 5 MB in total, so images go in a separate,
bigger store (IndexedDB), get shrunk on upload, and are included in backups.

### 7. Collapse a list: approved, design to be refined

Approved, but the owner said it "needs some improvement" and will say how
later. The plan holds the starting design (a narrow strip with the title
written sideways, the card count and the colour; click to expand; cards can
still be dropped onto it) and tells the build chat to ask the owner for
their changes first. Technical catch: the collapse can't animate the
column's width (a project rule), so it uses a transform-based slide or a
simple fade.

### 8. Clickable links in thots: approved

Approved as proposed. Web links in pregame and postgame thots become
clickable and open in a new tab; clicking elsewhere still edits; long links
are shortened for display. Titles are left alone, because clicking a title
renames it. Only http/https links, for safety.

### 9. Keyboard shortcuts: approved and widened

The owner approved the proposed set and said they'll eventually have "an
insane amount" of shortcuts. So the plan builds a **shortcut system** first:
one registry, one listener, scopes (global / card / list), a clash check,
never firing while typing, and a help dialog generated from the registry, so
adding a shortcut is one line. Then the first batch: arrow keys to move
focus, N / Shift+N for a new card below / above, E to rename, T for thots,
Delete to trash, D to duplicate a list, ? for help.

### 10. Automatic backup: approved, both parts

The owner wants both: a **reminder** ("Last backup: 9 days ago · Back up
now", works in every browser) and **automatic backup to a folder** (Chrome
and Edge only; ideally a OneDrive/Google Drive folder, so it's also in the
cloud). Chrome needs one click to resume after each browser restart; the
app shows that clearly. Found during planning: the existing manual export
quietly swaps a board that fails to load for an empty one. The plan fixes
that first, because with automatic backups and old files being deleted, it
could eventually wipe out every good copy of a board.

## Status

All ten reviewed, all approved. Suggested build order (earlier ones are
reused by later ones):

1. #2 New board from layout (smallest, useful immediately)
2. #1 Move or copy to another board
3. #10 Backup reminder and automatic backup (protects everything else)
4. #8 Clickable links
5. #9 Keyboard shortcut system
6. #3 Search (registers its Ctrl+K in #9's system)
7. #4 Special card types
8. #5 Custom colours
9. #6 Light theme, then background colour, then background image (needs #5)
10. #7 Collapse a list (once the owner has decided on the changes)
