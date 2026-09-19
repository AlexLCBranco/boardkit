# Feature plans

Standalone plans for features the owner approved on 2026-09-19. Each one is
built in **its own chat**. They're separate from `PLAN.md` (the live work
queue); the decisions behind them are in [`feature-review.md`](./feature-review.md).

## Build order

Earlier plans are reused by later ones, so this order avoids rework.

| Order | # | Plan | Depends on |
|---|---|---|---|
| 1 | 2 | [New board from layout](./new-board-from-layout.md) | — |
| 2 | 1 | [Move or copy to another board](./move-to-another-board.md) | — |
| 3 | 10 | [Backup reminder + automatic backup](./automatic-backup.md) | — |
| 4 | 8 | [Clickable links in thots](./clickable-links.md) | — |
| 5 | 9 | [Keyboard shortcut system](./keyboard-shortcuts.md) | — |
| 6 | 3 | [Search across all boards](./search-all-boards.md) | #9 (registers Ctrl+K) |
| 7 | 4 | [Special card types](./special-card-types.md) | — |
| 8 | 5 | [Custom colours](./custom-colours.md) | — |
| 9 | 6 | [Light theme, backgrounds](./backgrounds-and-themes.md) | #5 |
| 10 | 7 | [Collapse a list](./collapse-list.md) | owner's design changes |

## Starting a chat

Paste this into a new chat, changing the file name:

> Read plans/README.md and plans/new-board-from-layout.md, then build it.

The build chat should:

1. Read `CLAUDE.md`, `PLAN.md`, this file and the plan.
2. Check `git status` and pull.
3. **Ask the owner the plan's "Before starting" questions,** if it has any
   (#1, #4, #7 do).
4. Claim the item in `PLAN.md`'s "In flight" table, so Codex doesn't start
   on the same files.
5. Say what it's about to build and why, then build it.
6. Finish as each plan's "Done when" says: build passes, checked in the
   browser, `ARCHITECTURE.md` entry, patch version bumped, commit, push.
7. When done, un-claim it in `PLAN.md` and mark it **Built** in the table
   below, with the version.

## Status

| # | Plan | Status |
|---|---|---|
| 1 | Move or copy to another board | Built (v0.0.33) |
| 2 | New board from layout | Built (v0.0.32) |
| 3 | Search across all boards | Not started |
| 4 | Special card types | Not started |
| 5 | Custom colours | Not started |
| 6 | Light theme, backgrounds | Not started |
| 7 | Collapse a list | Not started |
| 8 | Clickable links in thots | Built (v0.0.37) |
| 9 | Keyboard shortcut system | Built (v0.0.41) |
| 10 | Backup reminder + automatic backup | Built (v0.0.35 reminder, v0.0.36 folder backup) |

## Gotchas every plan shares

- **Only the board being viewed is in memory.** Other boards are JSON in
  `localStorage` (`src/store/persistBoard.ts`). Call `flushPersist()` before
  reading one: saves wait 400ms, and a just-left board may still be pending.
- **Never write over a board that failed to load.** `loadPersistedBoard`
  returning `null` means missing *or* corrupt; stop and warn.
- **The 50-card limit** (`src/domain/limits.ts`) applies to every way a card
  enters a list.
- **Animate `transform` and `opacity` only;** colours, spacing and timings
  come from `src/styles/tokens.css`.
- **The owner's strengths to protect:** colours, the double thots, and drag
  smoothness. A change that makes any of them worse is a regression.
- **Another chat's dev server may already be on port 5173.** To check the
  app in the browser, add a temporary second entry to `.claude/launch.json`
  on 5174 (`npm run dev -- --port 5174 --strictPort`), and revert it
  afterwards.
