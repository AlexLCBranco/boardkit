# Plan: custom colours beyond the palette

A small, self-contained plan for one feature. It is **not** part of
`PLAN.md`'s queue. Approved by the owner 2026-09-19 (see
[`feature-review.md`](./feature-review.md), #5), **on the condition that it
doesn't glitch the way Excalidraw's does.** The glitch guards below are the
point of the plan, not extras.

## What the user gets

- The colour swatches on a list or card (`ColorSwatchPicker`, inside
  `CustomizePanel`) gain a **"+" swatch** that opens a colour picker: a
  shade area, a hue slider, and a hex box (`#1e90ff`).
- The colour updates live on the card or list while dragging in the picker.
- **Recent custom colours** appear as extra swatches after the palette, so
  a colour picked once is one click the next time.
- Everything that works with palette colours works with custom ones: list
  colour cascading to its cards, a card's own colour overriding it, the drag
  overlay, PNG/PDF export, copy as image, undo.

## The glitches, and how each one is avoided

Researched in Excalidraw's issue tracker, 2026-09-19.

1. **"The colour I picked isn't the colour I see."** This is Excalidraw's
   biggest one ([#3531](https://github.com/excalidraw/excalidraw/issues/3531),
   open since 2021). Its dark mode runs the whole canvas through
   `invert` + `hue-rotate` filters, so a custom colour comes out as a
   different colour. *Here:* never filter or transform user colours. Boardkit
   has one theme today; if a light/dark switch is ever added, it swaps
   token values, never applies a filter over user colours.
2. **Unreadable text.** Excalidraw doesn't have to deal with this; we do.
   Any colour is allowed, so a card can end up with a tint that makes its
   text hard to read. *Here:* compute the card's actual background (the
   tint is `color-mix(... 45%, transparent)` over the card surface; see
   `CardItem.module.css`) and choose light or dark text by contrast ratio
   (WCAG, at least 4.5:1). The contrast maths is a pure function in
   `domain/`.
3. **Invalid hex silently ignored**
   ([#9527](https://github.com/excalidraw/excalidraw/issues/9527)): typing
   `12345` or `blue` does nothing and says nothing. *Here:* accept 3- and
   6-digit hex with or without `#`. Anything else gets a red outline and a
   short message, and the colour is left unchanged.
4. **Picker popover covering other menus**
   ([#10863](https://github.com/excalidraw/excalidraw/issues/10863)).
   *Here:* use a Radix-based popover (shadcn `Popover`), which repositions
   to stay on screen and doesn't overlap its trigger.
5. **One drag in the picker creating dozens of undo steps and saves.**
   *Here:* while the picker is being dragged, update a live preview only;
   commit **one** store write (and so one undo step, one save) when the
   drag ends or the hex is confirmed. Escape reverts to the colour from
   before the picker opened.

## How it works

- **Data:** `color` on `List` and `Card` becomes `PaletteColor | HexColor`,
  where `HexColor` is a branded `#rrggbb` string (normalised to lowercase,
  6 digits). Old boards load unchanged, since palette names are still valid.
  On load, an invalid colour string is dropped (no colour), never a load
  failure.
- **CSS:** today the accent is set as `var(--palette-<name>)`; a custom
  colour sets the same `--card-accent` / `--list-accent` custom property to
  the hex value directly. Everything downstream (the 45% tint, borders,
  the drag overlay's explicit re-setting of both properties) keeps working
  unchanged. A user-picked colour is runtime data, not a design constant,
  so this doesn't break the "no hardcoded colours" rule; the picker's own
  chrome still uses tokens only.
- **Recent colours:** the last 8 custom colours used, most recent first,
  stored **per browser** in `localStorage` (not per board): a colour picked
  on one board is available on all of them.
- **Picker component:** check whether an existing small, dependency-light
  picker fits (e.g. `react-colorful`, ~2 KB, no dependencies) before
  writing one. Either way, it's supporting chrome: Tailwind and shadcn, not
  board-engine CSS Modules.

## Out of scope

- Gradients, transparency, or colours with alpha.
- An eyedropper (browser support is patchy).
- Editing or reordering the built-in palette.

## Done when

- A list and a card can each be given any colour via the picker or hex box,
  and it looks exactly like the chosen colour.
- Text stays readable on every colour, checked at least on white, black,
  pure yellow, navy and a mid-grey.
- Invalid hex shows an error and changes nothing.
- Dragging in the picker creates one undo step; Escape reverts.
- Custom colours survive reload, board switch, duplicate board, backup
  export/import, PNG/PDF export and copy as image.
- `npm run build` passes; checked in the browser.
- `ARCHITECTURE.md` has an entry; `package.json` patch version bumped;
  one commit on `main`.
- Before starting, claim it in `PLAN.md`'s "In flight" table so Codex
  doesn't start on the same files.
