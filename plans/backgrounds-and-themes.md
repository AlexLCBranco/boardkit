# Plan: board backgrounds (colour and image) and a light theme

A self-contained plan for one feature area. It is **not** part of
`PLAN.md`'s queue. Approved by the owner 2026-09-19 (see
[`feature-review.md`](./feature-review.md), #6): **all three parts.**

It's bigger than the other plans, so build it as **three separate commits**,
in this order. Each one leaves a working app.

1. Light theme
2. Per-board background colour
3. Per-board background image

**Build [`custom-colours.md`](./custom-colours.md) (#5) first.** Parts 1 and 2
reuse its colour picker and its readable-text (contrast) function.

---

## Part 1: light theme

### What the user gets

A theme switch with three options, **Dark / Light / System** ("System"
follows the computer's setting). It applies to the whole app, and is
remembered per browser, not per board. It goes in the toolbar or the board
menu, wherever fits with the existing controls.

### How it works

- Today `src/styles/tokens.css` defines one set of values on `:root` (dark
  surfaces like `--surface-app: #14161b`, light text like
  `--text-primary: #e8eaee`). Add a light set that **overrides the same
  token names** under `:root[data-theme="light"]`. Components don't change:
  they keep reading `var(--surface-raised)` etc.
- shadcn's colours are already bridged to these tokens in `global.css`'s
  `@theme inline` block, so shadcn chrome follows automatically. Check
  shadcn's `dark:` variant (`@custom-variant dark (&:is(.dark *))` in
  `global.css`): keep a `.dark` class on the root in sync with the theme,
  or classes using `dark:` will look wrong.
- "System" reads `prefers-color-scheme` and listens for changes.
- Set the theme attribute **before first paint** (a tiny inline script in
  `index.html` reading the saved choice), or the app will flash dark before
  turning light on every load.
- **Palette colours are tuned for dark.** On light surfaces, list and card
  tints (`color-mix(... 45%, transparent)` in `CardItem.module.css`) will
  look different. Check every palette colour on light, adjust tint strength
  per theme via a token if needed, and use #5's contrast function so text
  stays readable.
- Switching theme must not animate anything except `opacity` (e.g. no
  animated background-colour transitions across the whole page).

### Done when

- Dark, Light and System all work; the choice survives reload; no flash of
  the wrong theme on load.
- Every palette colour and a few custom ones are readable on both themes.
- shadcn dialogs, menus and tooltips look right in both.
- PNG/PDF export and copy-as-image use the current theme's colours.

---

## Part 2: per-board background colour

### What the user gets

The board menu gains **"Background…"**, with the palette swatches, #5's
custom colour picker, and "None" (the theme's default). Each board keeps
its own background, so boards can be told apart at a glance when
switching.

### How it works

- Add an optional `background?: BoardBackground` to the board's saved
  content (`BoardState` in `src/domain/types.ts`). Optional, so old boards
  load unchanged (no schema bump, same approach as `trash`).
  `BoardBackground` starts as `{ kind: "color", color: PaletteColor | HexColor }`
  and gains an image variant in part 3.
- Changing it goes through `withHistory`: one undo step.
- Rendered as a CSS custom property (e.g. `--board-background`) on the
  board canvas. The toolbar and board title that sit on the background use
  #5's contrast function to stay readable.
- `duplicateBoard` and "new board from these lists"
  ([`new-board-from-layout.md`](./new-board-from-layout.md)) carry the
  background over.
- Decide and document: does a board background apply in both themes as-is?
  Suggested: yes. It's the user's explicit choice, and the lists and cards
  sit on their own themed surfaces anyway.

### Done when

- Each board can have its own background colour (palette or custom), or
  none; it survives reload, switching, duplicating, backup export/import,
  and shows in PNG/PDF export.
- Toolbar text stays readable on any background.

---

## Part 3: per-board background image

### What the user gets

"Background…" also offers **"Choose image…"**. The image fills the board
behind the lists, with a gentle dark (or light, per theme) wash over it so
lists stay readable. A slider or two presets ("subtle" / "strong") control
how strong the wash is.

### Why this part needs care: storage

Boards are saved in `localStorage`, which holds roughly **5 MB for the whole
app**, shared by every board. A single phone photo can be 3–8 MB. Putting
images there would fill storage after one or two boards, and every save
after that would silently fail.

### How it works

- **Store images in IndexedDB,** not `localStorage`. It holds far more
  (hundreds of MB or more, depending on the browser and disk). The board
  saves only a reference: `{ kind: "image", imageId, wash }`.
- **Shrink on upload:** resize to at most 2560px on the long edge and
  re-encode as WebP (JPEG fallback), ~0.8 quality. That brings a typical
  photo to a few hundred KB. Reject non-image files with a clear message.
- **Clean up:** when a board is deleted, or its image replaced, delete the
  image from IndexedDB if no other board still uses it (duplicated boards
  share the same `imageId`).
- **If the image is missing** (storage cleared, or IndexedDB unavailable in a
  private window), fall back to the theme's default background. Never an
  error or a blank board.
- **Backups:** the backup file (`domain/persistence.ts`,
  `boardkit-backup`) must include the images, base64-encoded, or restoring
  a backup loses them. Import writes them back into IndexedDB. Tell the
  user the backup will be larger.
- **Performance, priority 1:** the image must not slow down dragging or
  scrolling. Put it on its own fixed layer behind the lists (a separate
  element, promoted with `will-change: transform` or similar), **not**
  `background-attachment: fixed`, which repaints on every scroll.
  Check drag smoothness with an image on.
- **PNG/PDF export** includes the image and wash.
- Put the IndexedDB code in its own module in `src/store/` (like
  `persistBoard.ts`), and the resizing in `src/features/board/`, which
  needs the browser's canvas API, so not `domain/`.

### Done when

- An image can be set, changed and removed per board; the wash keeps lists
  readable in both themes.
- A 10 MB photo uploads fine and is stored at a few hundred KB.
- Dragging and scrolling are as smooth with an image as without.
- Images survive reload, board switch, duplicate, and backup export/import;
  deleting a board frees its image unless another board uses it.
- A missing image falls back cleanly.

---

## For all three parts

- `PLAN.md`'s "Not being built" section lists "board-level themes" as
  not-started-until-asked. The owner has now asked: remove it when part 2
  lands.
- Theme chrome and the background menu are supporting UI (Tailwind and
  shadcn). The board surface itself stays CSS Modules against `tokens.css`.
- Per commit: `npm run build` passes, checked in the browser,
  `ARCHITECTURE.md` entry, `package.json` patch version bumped.
- Before starting, claim it in `PLAN.md`'s "In flight" table so Codex
  doesn't start on the same files. `tokens.css` is touched by almost
  everything, so check nothing else is in flight on it.
