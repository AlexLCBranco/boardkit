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
| Continued numbering across lists (+ queued item 1, quadratic numbering) | Claude |

## Queued

From a code review of the milestone-9 codebase. Order is by severity, not by
effort.

1. **Card numbering is quadratic.** Every card subscribes to a selector that
   runs `indexOf` over its whole list (`store/selectors.ts` `useCardNumber`,
   `domain/numbering.ts`). Zustand re-runs every subscribed selector on every
   store update, and `onDragOver` fires many times per second — so this sits
   directly on the drag hot path, which is priority 1. Fix: number the cards
   in one pass in `ListColumn`'s existing `cardIds.map` and pass the number
   into `CardItem` as a prop. `computeCardNumber` leaves the render path.

2. **A cross-list drag is not atomic.** `handleDragOver` commits the move as
   soon as the pointer crosses a list boundary, but `onDragCancel` only
   clears the overlay — so Escape mid-drag leaves the card moved. One drag
   also produces one undo entry per boundary crossed. Fix: snapshot
   `cardOrder` on drag start, keep writing on drag-over with history
   suppressed, then push a single history entry on drop or restore the
   snapshot on cancel. Note this overturns a deliberate decision recorded at
   `store/boardStore.ts`'s `moveCardBetweenLists` — the reasoning there
   (the board visibly changed at each crossing, so each crossing is its own
   undo step) is being rejected, not overlooked. Do **not** build a separate
   preview layer: drag-over must stay a real store write, because
   `SortableContext` reads its items from the store.

3. **Tests.** There are none. `domain/` is pure and React-free precisely so
   it can be tested — `history.ts`, `ordering.ts`, `numbering.ts` and
   `persistence.ts` are the targets. Write the drag-transaction tests as part
   of item 2, not after it.

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
