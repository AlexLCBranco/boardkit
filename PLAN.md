# Boardkit — Work in progress

What is queued, what is in flight, and what is deliberately not being built.

The milestone roadmap that built the project's first version is retired — it
was scaffolding for getting from nothing to a working base, and that job is
done. The record of what was built and why now lives in
[`ARCHITECTURE.md`](./ARCHITECTURE.md).

Two agents work in this repo: **Claude** and **Codex**. Put your name in the
Owner column before starting an item, so both agents do not land in the same
files.

## In flight

| Item | Owner |
|------|-------|
| _nothing_ | — |

## Queued

From a code review of the milestone-9 codebase. Order is by severity, not by
effort.

1. ~~**Card numbering is quadratic.**~~ Done in v0.0.53, alongside continued
   numbering: each list is numbered in one pass (`useCardNumbers`) and each
   card gets its number as a prop. Kept here so the item numbers below, which
   other docs cite, stay stable.

2. ~~**A cross-list drag is not atomic.**~~ Done in v0.0.65: a card drag
   snapshots `cardOrder` on start, previews list crossings without history,
   and settles into one undo step on drop or rolls back on Esc. See
   `domain/cardDrag.ts` and ARCHITECTURE.md.

3. **Tests.** Vitest is set up (`npm test`), and the drag transaction is
   covered (`domain/cardDrag.test.ts`). Still untested: `history.ts`,
   `ordering.ts`, `numbering.ts` and `persistence.ts`.

4. **Pending saves are not flushed on page hide.** Board and registry writes
   debounce 400ms with no `pagehide`/`visibilitychange` flush, so a fast
   reload after an edit loses it. `flushPersist` already exists and is
   already called on board switch. Use `pagehide` and `visibilitychange`, not
   `beforeunload` — mobile Safari never fires it.

5. **Persistence validation is shallow, and fails destructively.**
   `domain/persistence.ts` checks only that four containers exist; it does
   not validate entities, ids, or references. The important half is the
   failure mode: invalid data returns `null`, which silently replaces the
   user's board with a fresh one. Fix toward *repair*, not stricter
   rejection — drop `cardOrder` ids with no matching card, drop `listOrder`
   ids with no list, synthesise a missing `cardOrder[listId]` as `[]` — and
   reject only genuinely unsalvageable structure.

6. **Unused shadcn components.** 62 files in `src/components/ui/`; only
   `dropdown-menu` is imported by app code (`BoardSwitcher.tsx`). Worth
   noting the payoff is smaller than it looks: Rollup already tree-shakes the
   unimported ones out of the JS bundle, so this is a CSS-weight and
   lint-noise cleanup (Tailwind v4 scans source files for class names), not a
   402 KB JS saving. Removing the files does not shrink `node_modules` unless
   the Radix packages are pruned from `package.json` too. Lowest priority.

## Not being built

Hard scope boundaries live in [`CLAUDE.md`](./CLAUDE.md) and are not
negotiable here.

These are merely un-started — the architecture stays open to them, but do not
begin one without an explicit request: filtering the
board, a command palette, touch refinement, manually
reordering the board list (it is newest-first only).
