# Built — boardkit

Shipped work only, newest first. Planned work is in `FEATURE_BACKLOG.md`, never here.
Entries dated before 2026-11-16 were backfilled from the git commit messages (data, docs, test-only, merge and
spec commits left out). New entries name their backlog ID (see CLAUDE.md, "Feature backlog, built list and ideas").

## 2026-11-14
- Whiteboard copies: read, write and delete a whole board for the gauntlet (v0.0.108)
- On the gauntlet whiteboard a card under the pointer gets its hover look and its buttons (v0.0.107)

## 2026-11-05
- Whiteboard list widgets and Ctrl+C for the whiteboard (v0.0.106)

## 2026-10-23
- Links on cards, lists and the board (v0.0.105)
- PLAN: claim links on boards, lists and cards (Claude)

## 2026-10-21
- CLAUDE.md: tests and scripts run headless and leave no window open
- A click away saves what was typed, as Enter does; empty new fields just close; list header controls get data-control markers (v0.0.104)
- Whiteboard: Boardkit and Linkkit on one page hear each other's writes (v0.0.103)
- A new list confirmed with Enter opens its Add a card field at once (v0.0.102)
- Whiteboard mode: card + as a row inside the list, list + as a ghost column, header count at the right end (v0.0.101)
- CI: lint, unit tests and build on every push
- Whiteboard mode, gauntlet phase 2.5 (v0.0.100)

## 2026-10-20
- Whiteboard can create and rename a board without opening it (v0.0.99)
- PLAN.md: claim whiteboard New board (Claude)

## 2026-10-19
- Delete-board question names a linked map after the board as it is now
- Whiteboard: no panel or board background behind the lists
- Fix the crash on a card dropped at another list's top edge, and save that move
- A dragged card crosses lists at most once per pointer position
- Card drags cross only into the list under the pointer
- Whiteboard: mark the lifted copy while a card or list is dragged (data-boardkit-lifted)
- Fix: save a card dragged into another list when the drop changes nothing more
- Save a card dragged into another list when the drop changes nothing more
- Whiteboard: resizing and fitting a list work inside a scaled board, and reach only that board's lists
- Whiteboard: cards and lists drag correctly inside a scaled board
- Whiteboard entry: a board drawn and edited by Boardkit's own components on the gauntlet whiteboard
- Run on previews of the gauntlet site, without automatic backups

## 2026-10-18
- Add embed mode for the gauntlet canvas: ?embed=1&id=<board id>
- PLAN.md: claim embed mode for the gauntlet canvas (Claude)

## 2026-10-17
- Move selected title text into a thots box from a right-click menu
- Let a list choose one thots box or two per card
- Show a red check mark as an X, not a red tick
- Add check circles to lists: green or red check per card

## 2026-10-16
- Add tests for automatic backup

## 2026-10-11
- Patch vulnerable build-time deps; mark shadcn as dev-only

## 2026-10-09
- Restore a trashed card to its old place, not the end of the list
- Add AGENTS.md pointing agents at CLAUDE.md
- Add testing policy to CLAUDE.md

## 2026-10-08
- Keep fields this build doesn't know on the board and its trash entries

## 2026-10-07
- Show a "moved" notice at old addresses
- Fix undo of a card erased in another tab; add stress tests
- Keep undo working after another tab's or Linkkit's change
- Name the linked Linkkit map when deleting a board
- Show keep / maybe / cut badges on cards and lists
- Save boards as version 2 and open newer versions read-only

## 2026-10-06
- Ask before leaving the page while saves are failing
- List a board in the saved list only once its content is stored
- Name boards whose content is missing instead of opening them empty
- Make "Try again" retry every failed save, not just the open board
- Show a banner while saving fails, and catch image saves storage refused
- ARCHITECTURE.md: put the trash-caps note under 'Since milestone 9'
- Raise trash caps and warn before a full trash erases anything
- Serve /boardkit/ with a trailing slash on the app's own address
- Serve Boardkit under /boardkit and restore all boards at a new address
- Hold back only a damaged board in automatic backups
- Keep a single damage-test board, reopening it if still damaged
- Say when no backup has a damaged board, and let ?damage-test reuse its board
- Remove a deleted board's set-aside damaged copies
- Add ?damage-test to try the recovery notice on a throwaway board
- Make the damaged-board notice say what each choice does
- Bump to v0.0.68 and note the open-field save in the docs
- Save an open text field's draft when the page hides

## 2026-09-29
- Repair damaged boards instead of replacing them
- Collapse a list to a thin strip
- Mark the page-hide save flush as done in the docs
- Make a card drag one undo step, and roll it back on Esc

## 2026-09-28
- Move the continue-numbering toggle into the list panel
- Line up a list's first card number with the rest
- Add PROJECT.md, a short snapshot of the project for Claude chat

## 2026-09-23
- Keep pointer presses inside a field being edited
- Add a reset-to-default button to the selection bar
- Let a list hide its card numbers
- Highlight every selected card at once
- Let a card wear a highlight border
- Let lists and cards style their numbers
- Give card numbers their own gutter strip
- Show the number range on the list a numbering run starts from
- Show a continuing list's number range in its count pill
- Let a list continue the previous list's card numbering
- Claim continued list numbering in PLAN.md

## 2026-09-19
- Keep the add-card field in view while adding cards
- Keep popovers on screen near the viewport edge
- Add per-board background images with a dimming slider
- Add a per-board background colour
- Add a light theme with a Dark / Light / System switch
- Allow blank card and list titles
- Let custom colours be removed from the saved list
- Stop the customise panel's drags from moving its card
- Add custom colours beyond the palette
- Add search across all boards (Ctrl/Cmd+K)
- Add a keyboard shortcut system and the first batch of shortcuts
- Let the user cancel a paste
- Stop the first card's selection ring being clipped
- Add marquee selection with copy and paste of cards
- Add clickable links in pregame and postgame thots
- Add automatic backup to a chosen folder (Chrome/Edge)
- Add a backup reminder to the board menu
- Reorder card hover buttons: thots, colour, move, delete
- Add move/copy of a card or list to another board
- Add "New board from these lists" to the board switcher
- Add approved feature plans and a plans index
- Add a standalone plan for moving cards and lists between boards
- Cap each list at 50 cards
- Cap lists at 50 cards in the project priorities
- Ask for a name when creating a new board

## 2026-09-18
- Add Save dialog: download the whole board as a PNG or PDF
- Fix boards vanishing from the list when switching boards
- Save a new board to storage immediately on creation
- Add Duplicate list via right-click on the list header
- Add Delete board, list boards newest-first
- Fix type error in backup import
- Add export and import of all boards as a JSON backup file
- Add a Duplicate board action to the board switcher
- Add a toolbar button to copy the whole board as an image
- Restore the horizontal scrollbar when lists overflow the board

## 2026-09-17
- Fix zoom control not reducing scrollable board width
- Revert copy-list-as-image to the v0.0.16 behaviour
- Fix blank output when copying a list as an image
- Capture a list's full height when copying it as an image
- Add a button to copy a list as a high-resolution image

## 2026-09-16
- Add Excalidraw-style zoom control to the board canvas
- Style native scrollbars to match the dark theme

## 2026-09-15
- Recolor card description background to match the card surface
- Preserve manual line breaks in committed inline-editable text

## 2026-09-14
- Document list-resizing gestures in the shortcuts dialog
- Add Shift-modifier to make every list match one width exactly
- Hold Alt to resize or auto-fit every list at once
- Double-click a list's resize handle to auto-fit its cards
- Replace list-width presets with an Excalidraw-style drag handle
- Add a per-list width option for longer card lines
- Trash deleted lists as a whole, not just their cards
- Lower the trash cap to 20 cards
- Trash a list's cards too when the list is deleted
- Move deleted cards to a trash instead of erasing them
- Switch version badge to semver instead of a raw commit SHA
- Show build version so a deployed bug fix is verifiable at a glance
- Make Enter commit a description like it already does a title
- Stop spacebar from being hijacked into a drag while editing text

## 2026-09-13
- Confirm before deleting a list
- Tint the whole column with its list colour, and let it override cards
- Add accent outline to card hover state
- Retire the milestone workflow for a live work queue
- Flush pending persistence saves on page hide
- Add a keyboard shortcuts reference dialog
- Make right-click toggle the thots section instead of open-only
- Collapse per-card thots into hover/right-click controls, add bulk toggle

## 2026-09-11
- Milestone 9: shadcn/ui, card rework, and multi-board support
- Milestone 8: persistence and undo/redo
- Milestone 7: customisation
- Milestone 6: motion and performance pass
- Milestone 5: drag across lists, reorder lists
- Milestone 4: drag and drop within a list
- Milestone 3: mutations and instant editing
- Add the session-opening ritual to PLAN.md
- Milestone 2: domain model, normalised store, seed data rendering
- Document the one-commit-per-milestone rule in CLAUDE.md
- Milestone 1: project foundation
