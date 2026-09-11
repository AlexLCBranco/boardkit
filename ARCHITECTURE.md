# Boardkit — Architecture

A high-performance visual board engine. Not a project-management tool.

## Layering

Dependencies point in one direction only. A layer may import from layers
below it, never from layers above.

```
app/          page shell, routing, providers
features/     board-specific UI (lists, cards, drag behaviour)
components/   generic, board-agnostic UI (buttons, popovers, inline edit)
store/        Zustand stores — the only stateful layer
domain/       pure TypeScript: types, ordering maths, invariants. No React.
styles/       design tokens + global reset
```

`domain/` is the part worth protecting. It has no React and no store import,
so ordering rules and move operations can be unit-tested as plain functions
and reused if the UI is ever replaced.

## State shape (normalised)

State is stored flat, not as a nested tree:

```ts
{
  lists: Record<ListId, List>,
  cards: Record<CardId, Card>,
  listOrder: ListId[],
  cardOrder: Record<ListId, CardId[]>,
}
```

Why not nest cards inside lists:

- Lookup by id is O(1) — a card component can subscribe to exactly its own
  card and re-render alone when it changes.
- A reorder mutates one small array of ids, not a deep object tree, so
  React's reference equality checks stay cheap.
- Moving a card between lists is two array splices, not a deep clone.

## Rendering and performance

- Components subscribe to the narrowest possible slice of the store. A card
  reads `cards[id]`; the list reads `cardOrder[listId]`. Editing one card's
  title must not re-render its siblings.
- Drag transforms are applied as `transform`/`opacity` only, so the browser
  can composite them on the GPU without layout or paint.
- Virtualisation of long lists is deferred until it is measurably needed, but
  the list component keeps a single scroll container so it can be dropped in
  without restructuring.

## Milestones

See [PLAN.md](./PLAN.md) for the detailed roadmap, acceptance criteria and
per-milestone starter prompts. Each milestone ends with a running
application.

1. **Foundation** — build tooling, layering, design tokens, empty board shell.
2. **Domain model + store** — entities, normalised store, static seed data
   rendering as real lists and cards.
3. **Mutations** — add, rename and delete lists and cards; instant inline
   editing. *(Complete: `InlineEditable` and `Composer` live in
   `components/`, board-agnostic; store actions each copy only the slice
   they touch, so a rename never re-renders an unrelated list or card.)*
4. **Drag within a list** — dnd-kit sortable, drag overlay, reorder cards.
   *(Complete: `DragContext.tsx` owns the one `DndContext`, its sensors and
   `closestCenter` collision detection; `domain/ordering.ts` holds the pure
   `moveWithinList` splice, unit-testable with no dnd-kit import; the store
   action is a thin wrapper over it. Each card is a `useSortable` item inside
   its list's `SortableContext`; the original stays in place at reduced
   opacity as a placeholder while a `DragOverlay` copy tracks the pointer.
   Cross-list drops are recognised — via `listId` carried in each sortable
   item's `data` — and deliberately ignored, since that is milestone 5.)*
5. **Drag across lists and drag lists themselves.** *(Complete: one
   `DndContext` still, but every draggable and droppable now carries a
   `{ type }` tag in its `data` -- `"card"`, `"list"`, or `"list-empty"` for
   an empty list's drop target -- and a custom `collisionDetection` wrapper
   filters candidates by that tag before running `closestCenter`, so a card
   drag can never resolve onto a list-reorder target or vice versa. A card
   is moved into a different list eagerly, in `onDragOver`, via the new
   `moveBetweenLists`; reordering within the list it is already in stays
   commit-on-drop via `moveWithinList`, unchanged from milestone 4, since
   dnd-kit's sortable preview already renders that live. Lists reorder the
   same way milestone 4's cards did -- `moveList` plus a `SortableContext` over
   `listOrder` -- with the column's `<header>` as the sole drag handle via
   split `listeners`/`setNodeRef`, so grabbing a card never grabs its list.
   dnd-kit's default auto-scroll needed no extra code.)*
6. **Motion and performance pass.** *(Complete: `src/styles/motion.ts` mirrors
   the duration/easing tokens as plain JS values for the one place a CSS
   custom property can't reach -- dnd-kit's `useSortable({ transition })`
   option -- and both `CardItem` and `ListColumn` now pass it, so every
   sortable item settles with a slight `ease-spring` overshoot instead of
   dnd-kit's unstyled default. The `DragOverlay` copy plays a one-shot
   `ease-out` lift-off animation on mount, deliberately not sharing the
   spring -- a pickup shouldn't overshoot, only a landing should. The
   `Composer`'s expansion is a fade-and-rise entrance rather than a height
   animation, since its final size is already correct the instant it
   mounts. `CardItem` and `ListColumn` were already `memo`-wrapped with
   narrow selectors from milestone 2 onward, so this milestone measured
   rather than changed that: see `PERFORMANCE.md` for the 1,000-card
   baseline and the reasoning for deferring virtualisation.)*
7. **Customisation.** *(Complete: `List` and `Card` each gained optional
   `color`/`icon` fields, drawn from the closed `PALETTE_COLORS`/`ICON_KEYS`
   sets in `domain/types.ts` rather than free-form values. A list's colour is
   set as a `--list-accent` custom property on the column element, which
   ordinary CSS inheritance carries down to every card inside; a card's own
   `--card-accent` overrides it when set, via
   `border-left-color: var(--card-accent, var(--list-accent, transparent))`
   in `CardItem.module.css`. `components/Popover.tsx` is a generic,
   board-agnostic portal-based popover (portalled to `document.body` so it
   escapes the column's own scroll clipping); `ColorSwatchPicker` and
   `IconPicker` build on it, and `CustomizePanel` combines the two for both
   `ListColumn` and `CardItem` to open. Icons are one inline `<symbol>`
   sprite (`IconSprite`, mounted once in `main.tsx`) referenced via `<use>`,
   not an icon library -- the set is fixed and small. Numbering is a board
   setting (`state.settings.numbering`, `"off" | "list" | "board"`) rather
   than a per-list one, and a card's number is never stored: `useCardNumber`
   computes it from `domain/numbering.ts`'s pure `computeCardNumber` on every
   read, returning `null` when numbering is off so a card's selector result
   stays referentially identical -- and skips re-rendering -- on every reorder
   until numbering is actually switched on.)*
8. **Persistence and undo/redo.**

## Decisions

- **Vite + React + TypeScript.** Fast HMR matters when tuning drag feel.
- **Zustand over Context/Redux.** Context re-renders every consumer on any
  change, which is fatal for a board with hundreds of cards. Zustand gives
  per-selector subscriptions with almost no ceremony.
- **dnd-kit over react-beautiful-dnd.** Actively maintained, sensor-based
  (pointer, keyboard, touch), and applies drag transforms outside React's
  render cycle.
- **CSS Modules + CSS custom properties over Tailwind.** Drag choreography
  and runtime-customisable colours are the two hardest things to express in
  build-time utility classes; both are native to custom properties.
