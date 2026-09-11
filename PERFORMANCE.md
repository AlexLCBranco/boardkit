# Boardkit — Performance baseline

Recorded at the end of Milestone 6. Re-run this measurement, and update the
numbers below, whenever a change touches rendering or drag internals.

## Method

`createLargeBoard()` in [src/domain/seed.ts](src/domain/seed.ts) builds a
10-list, 100-card-per-list board (1,000 cards) for exactly this purpose. To
reproduce:

1. In `boardStore.ts`, temporarily spread `createLargeBoard()` instead of
   `createSeedBoard()`.
2. Wrap `<BoardCanvas />` in `App.tsx` with React's `<Profiler id="board"
   onRender={...}>`, logging `phase` and `actualDuration` to the console.
3. `npm run dev`, open the board, and read the console.
4. Revert both changes before committing -- they are measurement scaffolding,
   not shipped code.

A true production number would need a `react-dom/profiling` build, which
this project doesn't ship; the numbers below come from the dev server
(unminified, `<StrictMode>` double-invoking renders), so read them as
**relative**, not absolute. StrictMode alone roughly doubles them.

## Results (1,000 cards, dev build)

| Interaction | Commit cost |
|---|---|
| Initial mount | ~310ms, one commit |
| Rename one card | 3 commits, ~1ms each |
| Drag a card ~4 positions within a 100-card list | several commits, 10–230ms each |

## Reading this

- **Renaming a card touches one component.** This is the number that
  matters for priority 3 (instant editing): the selector layer and `memo`
  on `CardItem` are doing their job. It costs the same whether the board
  holds 10 cards or 1,000, because the render only ever reaches the one
  card whose `cards[id]` entry changed.
- **A within-list drag costs more, proportional to the list, not the
  board.** Each sibling between the card's old and new index has to accept
  a new `transform` from dnd-kit's `useSortable`, and that's a real render
  each, not a memo bypass -- the update is driven by dnd-kit's own context,
  which `memo` can't intercept. The cost scales with *how far* a card
  moves within *its own list*, never with the other 900 cards elsewhere on
  the board.
- **The pointer tracking itself never touches React.** dnd-kit positions
  the `DragOverlay` with a transform it writes directly, outside any
  commit, which is why the numbers above -- real as they are in a dev
  build -- don't translate into visible stutter while dragging. The board
  reads as smooth well past 1,000 cards; what these numbers bound is the
  cost of the *reflow* when siblings make room, not the drag itself.

## Virtualisation: deferred, and why

Not added this milestone. Reasoning:

- The measured cost is bounded by *one list's* length, not the board's
  total card count -- a board with more lists of the same size doesn't get
  slower to drag within any single one of them.
- Each list already scrolls independently in its own container
  (`ListColumn`'s `.scroller`), which is the structural precondition
  virtualisation would need -- so adding it later doesn't require
  restructuring, only swapping the `<ul>` map for a windowed one.
- Virtualising would complicate the one piece of code this milestone spent
  the most effort tuning: dnd-kit needs every sortable item mounted (or at
  least reliably measurable) to compute drop targets, and a naive window
  would make items outside the viewport un-droppable.

Revisit this if a real board needs single lists well past a few hundred
cards, or if profiling a production build (not just this dev-mode
approximation) shows dropped frames during drag.

## Animation choreography

- **Pickup** (`CardItem.module.css` / `ListColumn.module.css` `.overlay`):
  a one-shot `ease-out` scale-and-shadow animation on the `DragOverlay`
  copy's mount. No overshoot -- lifting off shouldn't bounce.
- **Settle / reflow** (`src/styles/motion.ts`'s `sortableTransition`,
  passed to every `useSortable`): a slightly-overshooting `ease-spring`
  transition applied to every sortable item's transform, both when
  siblings make room mid-drag and when the dragged item lands. The
  overshoot is what makes a drop read as landing rather than just
  stopping.
- **Composer expansion** (`Composer.module.css`): a fade-and-rise entrance
  on mount, not a height animation -- the composer's final size is correct
  the instant it exists, so only opacity and `transform: translateY` need
  to move, keeping the animation compositor-only per the project's
  transform/opacity rule.
- All of the above sit inside the app-wide `prefers-reduced-motion` rule in
  `global.css`, which collapses every `animation-duration` and
  `transition-duration` to near-zero -- no per-animation opt-out needed.
