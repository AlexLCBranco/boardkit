# Boardkit — Project Plan

The roadmap and the source of truth for what to build next.

## How to use this across multiple chats

Each milestone is self-contained. To continue in a fresh session, open this
folder and paste that milestone's **Starter prompt**. `CLAUDE.md` loads
automatically and carries the scope rules and architecture constraints, so
you do not need to re-explain the project.

### Opening a new session

Open the session on this folder, then send one message in this shape:

> Read CLAUDE.md and PLAN.md. Confirm which milestone is next, then start it.
> Explain what you are building and why before you write code.

That is the whole ritual. Everything else the session needs is in the two
files it was just pointed at.

If the previous session ended badly, add one sentence saying what happened,
for example "the last session left the board blank, check what it changed
against the last commit".

Rules for every session:

- Only build the current milestone. Do not run ahead.
- Finish with a working app, a passing `npm run build`, and the status table
  below updated.
- If something in an earlier milestone turns out to be wrong, fix it rather
  than building around it, and say so.

## Status

| # | Milestone | State |
|---|-----------|-------|
| 1 | Foundation | Complete |
| 2 | Domain model and store | Complete |
| 3 | Mutations and instant editing | Complete |
| 4 | Drag and drop within a list | Complete |
| 5 | Drag across lists, reorder lists | Complete |
| 6 | Motion and performance pass | Complete |
| 7 | Customisation | Complete |
| 8 | Persistence and undo/redo | Complete |

---

## Milestone 1 — Foundation

**Complete.**

Build tooling, folder layering, design tokens, empty board shell.

Delivered: Vite + React + TypeScript, the `app / features / components /
store / domain / styles` layering, `src/styles/tokens.css` as the single
source of visual constants, and a horizontally scrolling board canvas that
renders empty.

Why it came first: the drag maths later measures against the board's scroll
container, and every animation reads its timing from the token file. Both are
expensive to retrofit and nearly free to settle up front.

---

## Milestone 2 — Domain model and store

**Complete.**

**Goal.** Real lists and cards appear on screen, rendered from a store,
using seed data. Still no interaction.

**Why now.** The data shape decides the performance ceiling. Getting it wrong
means every later milestone fights it. Rendering static seed data proves the
shape works before any mutation or drag logic depends on it.

**Build.**

- `src/domain/types.ts` — `Card`, `List`, `BoardState`, branded id types
  (`CardId`, `ListId`) so a card id can never be passed where a list id is
  expected.
- `src/domain/ids.ts` — id generation, wrapped so the generator can change.
- `src/domain/seed.ts` — a small seed board, plus a generator for a large one
  used to test performance later.
- `src/store/boardStore.ts` — Zustand store holding the normalised state.
- `src/store/selectors.ts` — named selector functions. Components import
  these rather than writing inline selectors, so subscription granularity is
  reviewable in one file.
- `src/features/board/ListColumn.tsx` plus module CSS — renders one list.
- `src/features/board/CardItem.tsx` plus module CSS — renders one card.
- Wire `BoardCanvas` to render lists from the store.

**State shape.**

```ts
{
  lists: Record<ListId, List>,
  cards: Record<CardId, Card>,
  listOrder: ListId[],
  cardOrder: Record<ListId, CardId[]>,
}
```

**Decisions to explain while building.**

- Why normalised state beats a nested tree: O(1) lookup, reorder touches one
  small array, moving a card across lists is two splices.
- Why ordering lives in id arrays rather than an `order: number` field on
  each entity: reordering must not require rewriting every sibling.
- Branded types: how they work and what class of bug they remove.
- Why the card component should be memoised and subscribe to `cards[id]`
  alone.

**Done when.** A seeded board renders several lists with cards, the type
check passes, and no component reads more of the store than it needs.

**Out of scope.** Any mutation, any drag, any editing.

**Starter prompt.**
> Milestone 2 from PLAN.md: build the domain types, the normalised Zustand
> store and the selector layer, then render seed data as real lists and cards.
> Explain the state-shape decisions as you go.

---

## Milestone 3 — Mutations and instant editing

**Complete.**

**Goal.** Add, rename and delete lists and cards, with editing that feels
immediate.

**Why now.** Mutations are simple while the data is static. Building them
before drag means the drag milestone only has to solve movement, rather than
also discovering that the store's update paths are awkward.

**Build.**

- Store actions: `addList`, `addCard`, `renameList`, `renameCard`,
  `deleteList`, `deleteCard`. Each one immutable and touching the minimum
  number of slices.
- `src/components/InlineEditable.tsx` — a generic click-to-edit text control.
  It lives in `components/`, not `features/`, because it knows nothing about
  boards.
- `src/components/Composer.tsx` — the add-a-card and add-a-list input.
- Keyboard behaviour: Enter commits, Escape cancels and restores, blur
  commits, and Enter in a composer submits while staying open for the next
  entry.

**Decisions to explain.**

- Why editing state is local component state rather than store state: it is
  transient, and putting it in the store would re-render subscribers on every
  keystroke.
- Autosizing textarea versus plain input, and why a card title needs to wrap.
- Focus management: why the composer must keep focus after submit, and how to
  avoid the layout jump when a new card is added.

**Done when.** Lists and cards can be created, renamed and deleted entirely
by keyboard, with no visible lag and no lost focus.

**Out of scope.** Drag, animation polish, colours.

**Starter prompt.**
> Milestone 3 from PLAN.md: store mutations plus inline editing and
> composers for lists and cards. Keyboard-first, instant, no drag yet.

---

## Milestone 4 — Drag and drop within a list

**Complete.**

**Goal.** Cards reorder by dragging inside their own list.

**Why now.** This is priority one, and it is the milestone the architecture
was shaped for. Doing single-list drag on its own keeps the first encounter
with dnd-kit sensors, collision detection and the drag overlay free of
cross-container complexity.

**Build.**

- `src/features/board/DragContext.tsx` — owns the `DndContext`, its sensors
  and its collision strategy. One place, so drag configuration never
  scatters.
- A `SortableContext` per list, with `useSortable` on the card.
- A `DragOverlay` rendering a lifted copy of the card. The original stays in
  place as a placeholder rather than being removed, so the list does not
  collapse mid-drag.
- An activation constraint of a few pixels of movement, so a click still
  reads as a click and not as a drag.
- `src/domain/ordering.ts` — a pure `moveWithinList` function, unit-testable
  without React.

**Decisions to explain.**

- Why dnd-kit applies its transform outside the React render cycle, and why
  that is the reason dragging can hold 60fps.
- Sensors: pointer, touch and keyboard, and why keyboard dragging is nearly
  free here and worth having.
- Why the reorder maths lives in `domain/` and the store action is a thin
  wrapper over it.

**Done when.** A card can be dragged to any position in its list, a visible
gap shows where it will land, and the store reflects the new order on drop.

**Out of scope.** Moving between lists, moving lists.

**Starter prompt.**
> Milestone 4 from PLAN.md: dnd-kit drag-and-drop for reordering cards within
> a single list, with a drag overlay and pure ordering logic in domain/.

---

## Milestone 5 — Drag across lists, reorder lists

**Complete.**

**Goal.** Cards move between lists, and whole lists reorder by dragging.

**Why now.** It extends the drag system rather than inventing a second one.
Doing it immediately after milestone 4 means the drag code is still fresh and
the abstractions can be corrected while they are cheap to change.

**Build.**

- Cross-container `onDragOver` handling, moving the card between `cardOrder`
  arrays as the pointer crosses list boundaries.
- Dropping onto an empty list.
- A second sortable axis for the lists themselves, with the list header as
  the drag handle so dragging a card never grabs its list.
- Auto-scroll, so the board scrolls when a drag approaches its edge.
- `moveBetweenLists` and `moveList` added to `src/domain/ordering.ts`.

**Decisions to explain.**

- Why the card is moved on drag-over rather than only on drop, and what that
  costs.
- Nested sortable contexts, and how dnd-kit decides which one a drag belongs
  to.
- Why a drag handle on the list header is the right call.

**Done when.** Cards move freely between lists including empty ones, lists
reorder, and the board auto-scrolls during an edge drag.

**Starter prompt.**
> Milestone 5 from PLAN.md: cross-list card dragging, list reordering with a
> header drag handle, and edge auto-scroll.

---

## Milestone 6 — Motion and performance pass

**Complete.**

**Goal.** The board feels fast and physical at a thousand cards.

**Why now.** Polish needs the full interaction set in place to be worth
tuning, and performance work needs something real to measure. Doing it before
customisation means the visual system is tuned once rather than twice.

**Build.**

- Animation choreography: card lift on pickup, settle on drop, list reflow,
  composer expansion. All on `transform` and `opacity`, timed from the
  tokens.
- `React.memo` on the card and list components, with a pass over selector
  granularity to confirm nothing re-renders that should not.
- Measurement with the React DevTools Profiler on a seeded 1000-card board,
  recorded in `PERFORMANCE.md` as a baseline.
- Virtualisation of long lists **only if** the measurement shows it is
  needed. If it is not needed, write down why.
- `prefers-reduced-motion` verified across every animation.

**Decisions to explain.**

- How to read a flame graph and identify an unnecessary re-render.
- Why virtualisation is deferred until measured rather than added on
  principle, and what it would cost in drag complexity.
- Why the easing curve differs between picking a card up and dropping it.

**Done when.** Dragging on a 1000-card board holds a steady frame rate, and
the profiler shows that a card edit re-renders one card.

**Starter prompt.**
> Milestone 6 from PLAN.md: animation choreography and a measured performance
> pass at 1000 cards. Profile before optimising and record the baseline.

---

## Milestone 7 — Customisation

**Complete.**

**Goal.** Lists and cards carry a colour, an icon and optional numbering.

**Why now.** It is the feature that makes this tool yours rather than a
generic board, and it sits on top of everything else without disturbing it.
It is also the reason CSS custom properties were chosen over Tailwind, so it
is the milestone that validates that decision.

**Build.**

- Extend the list and card entities with `color` and `icon` fields, plus
  board-level numbering settings.
- A per-list accent applied by setting a custom property on the list element,
  so one value cascades to every card inside it.
- `src/components/Popover.tsx` — a small positioned popover.
- A colour picker and an icon picker built on it.
- Card numbering, either per list or continuous across the board, computed at
  render time from position rather than stored, so it stays correct after
  every move.

**Decisions to explain.**

- Why a runtime colour is a custom property override rather than a class.
- Why numbering is derived rather than stored.
- Icon strategy: an inline SVG sprite, and why that beats an icon library for
  a fixed set.

**Done when.** A list's colour and icon can be changed from a popover, the
change cascades to its cards instantly, and numbering stays correct after a
card is moved.

**Starter prompt.**
> Milestone 7 from PLAN.md: per-list colours and icons via popovers, plus
> derived card numbering.

---

## Milestone 8 — Persistence and undo/redo

**Complete.**

**Goal.** The board survives a reload, and mistakes are reversible.

**Why now.** Last, because undo has to know about every mutation that exists.
Building it earlier means revisiting it after every new action.

**Build.**

- `localStorage` persistence with a schema version number and a migration
  path, written from the start so a future shape change does not discard
  existing data.
- Debounced writes, so typing does not hit storage on every keystroke.
- Undo and redo over a stack of inverse operations rather than full state
  snapshots, with a bounded history.
- Keyboard: Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z.

**Decisions to explain.**

- Inverse operations versus state snapshots, and why memory decides it.
- Why a schema version is written before it is ever needed.
- What should and should not enter the undo stack.

**Done when.** A reload restores the board exactly, and every mutation can be
undone and redone.

**Starter prompt.**
> Milestone 8 from PLAN.md: versioned localStorage persistence and undo/redo
> built on inverse operations.

---

## Beyond milestone 8

Not planned, and not to be started without an explicit request. Listed only
so the architecture stays open to them: export and import as JSON, multiple
boards, card descriptions, search and filter, board-level themes, a command
palette, touch refinement.
