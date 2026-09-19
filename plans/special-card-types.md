# Plan: special card types (divider first)

A small, self-contained plan for one feature. It is **not** part of
`PLAN.md`'s queue. Approved by the owner 2026-09-19 (see
[`feature-review.md`](./feature-review.md), #4).

## Why

The owner approved divider cards and widened it: "special cards as a whole,
types of special cards". So this builds a **card type** system, with the
divider as the first type, shaped so that adding a second or third type
later is a small change and not a rework.

## Before starting: ask the owner

1. **Which types besides the divider?** Suggested candidates, all within
   scope (visual, no dates, no checklists, no attachments):
   - **Note:** looks like a sticky note (different background, no number).
     For a reminder about the list itself, not a task.
   - **Highlight:** a bigger, bolder card for the one thing that matters
     most in a list.
   - Anything the owner has in mind.

   Build the divider plus whatever is chosen. If the answer is "just the
   divider for now", build the system with one type.
2. **Do special cards count toward the 50-card limit?** Default: yes, every
   card counts (simplest, and the limit is about keeping lists short).

## What the user gets (divider)

- A card's customise button (`CustomizePanel`, next to the colour swatches)
  gains a **"Card type"** choice: Normal, Divider, and any other chosen
  types. Switching back to Normal restores the card exactly as it was.
- A divider renders as a heading line across the list, not a card:

  ```
  ── EVENING ──────────
  ```

  Its label is the card's title, still renamed in place like any card.
  It takes the list's accent colour, or its own colour if one is set.
- It has **no number**, and the cards after it don't count it: "1, 2,
  divider, 3", not "1, 2, divider, 4".
- It has **no thots** section. Any thots it had as a normal card are kept,
  hidden, and come back if it's switched back to Normal.
- It drags, deletes, trashes, restores, duplicates, undoes and copies as
  an image exactly like any card.

## How it works

**Data:** one optional field on `Card` in `src/domain/types.ts`:
`kind?: CardKind`, where `CardKind` is a union like `"divider"` (plus any
added types). Absent means a normal card. Because it's optional, boards
saved before this load unchanged. No schema version bump, same approach as
`trash` in `domain/persistence.ts`.

**Type rules live in one place:** a new `src/domain/cardKinds.ts` (no React)
describing what each type does, for example:

```ts
{ numbered: boolean; hasThots: boolean; label: string }
```

Numbering, the thots toggle and the customise panel read from this table
instead of checking `kind === "divider"` all over the code. Adding a type
means one new entry here plus its look, which is the "easy to extend"
priority.

**Validation:** when loading, an unknown `kind` (e.g. from a newer version,
or a hand-edited backup) is treated as a normal card, never as a load
failure.

**Numbering:** `computeCardNumber` in `src/domain/numbering.ts` must skip
unnumbered types. Note: `PLAN.md` queued item 1 moves numbering into
`ListColumn`'s `cardIds.map` for performance. If that has landed, do the
skipping there; if not, coordinate so the two changes don't collide (check
`PLAN.md`'s "In flight" table).

**Rendering:** `CardItem` keeps `useSortable` and the drag wiring, and swaps
only the body per type (e.g. a small `DividerBody` component). The look is
CSS Modules against `tokens.css`, the same as the rest of the board engine:
no hardcoded colours or spacing, and nothing animated except transform and
opacity. The drag overlay (`CardOverlay` in `DragContext.tsx`) must render a
divider as a divider too, or it will turn into a card mid-drag.

**Store:** a `setCardKind(cardId, kind)` action through `withHistory`, so
changing a card's type is one undo step.

## Out of scope

- A separate "add a divider" composer. A divider starts as a normal card
  and is switched; one path is enough for now.
- Collapsing the section under a divider. Possible later, not now.

## Done when

- A card can be switched to Divider and back from its customise panel, with
  no data lost either way.
- Dividers are unnumbered and don't shift the numbers after them.
- Dividers drag (including the drag overlay), trash, restore, duplicate,
  undo, and appear correctly in PNG/PDF export and "copy as image".
- Old boards load unchanged; an unknown `kind` loads as a normal card.
- Each other approved type works to the same standard.
- `npm run build` passes; checked in the browser.
- `ARCHITECTURE.md` has an entry (the card-type table and how to add a
  type); `package.json` patch version bumped; one commit on `main`.
- Before starting, claim it in `PLAN.md`'s "In flight" table so Codex
  doesn't start on the same files.
