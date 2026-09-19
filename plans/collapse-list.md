# Plan: collapse a list to a thin strip

A small, self-contained plan for one feature. It is **not** part of
`PLAN.md`'s queue. Approved by the owner 2026-09-19 (see
[`feature-review.md`](./feature-review.md), #7).

> **The owner said this idea "needs some improvement"** and will refine it
> before it's built. **Start the build chat by asking what they want
> changed.** Everything below is the starting design, not a final spec.

## Starting design

- A small arrow button in the list header collapses the list into a narrow
  vertical strip showing:
  - the list's title, written sideways;
  - its card count;
  - its icon and accent colour.
- Clicking the strip (or its arrow) expands the list again.
- A card dragged onto the strip is added to the bottom of that list, still
  respecting the 50-card limit (`domain/limits.ts`).
- A collapsed list can still be dragged to reorder lists, and its header
  menu (duplicate, delete) still works.
- Use: get lists you don't need right now ("Done", "Someday") out of the way
  without deleting them.

## Technical notes for whoever builds it

- **Data:** optional `collapsed?: boolean` on `List` (`src/domain/types.ts`).
  Optional, so old boards load unchanged. Saved with the board.
- **Undo:** follow whatever list width does today (`setListWidths` in
  `boardStore.ts`). If width changes are undoable, collapsing is too.
  Collapse state and width are the same kind of setting.
- **The animation is the hard part.** Collapsing changes the column's
  width, and CLAUDE.md forbids animating `width`. Options:
  - Change the width instantly, and animate only the contents' `opacity`
    and the neighbouring lists sliding over, using a FLIP-style
    `transform` (measure positions before and after, then animate the
    difference with `transform`).
  - Or no slide at all: an instant change with a short fade. Simpler.

  Pick with the owner; either way, only `transform` and `opacity` move.
- **Drop target:** the strip needs its own droppable (like
  `EmptyListDropZone` in `ListColumn.tsx`), and `DragContext.tsx`'s
  collision filter must treat it as a card target, not a list target.
- **Numbering, the drag overlay** (`ListOverlay` in `DragContext.tsx`) and
  **PNG/PDF export** should all show a collapsed list as a strip.
- Supports the owner's many-short-lists style: keep the strip compact but
  still easy to hit with a mouse.

## Done when

(To be confirmed after the owner's changes.)

- Lists collapse and expand; the state survives reload and board switch.
- Only `transform` and `opacity` are animated.
- Cards can be dropped onto a collapsed list; a full list refuses them.
- Collapsed lists can be reordered and still have their header menu.
- `npm run build` passes; checked in the browser.
- `ARCHITECTURE.md` has an entry; `package.json` patch version bumped;
  one commit on `main`.
- Before starting, claim it in `PLAN.md`'s "In flight" table so Codex
  doesn't start on the same files.
