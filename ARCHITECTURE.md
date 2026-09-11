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
   editing.
4. **Drag within a list** — dnd-kit sortable, drag overlay, reorder cards.
5. **Drag across lists and drag lists themselves.**
6. **Motion and performance pass** — animation choreography, memoisation,
   measurement at thousands of cards.
7. **Customisation** — per-list colours, icons, card numbering.
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
