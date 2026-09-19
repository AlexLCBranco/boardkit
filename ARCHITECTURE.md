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

## Build history

The project's first version was built as nine numbered milestones. That
roadmap is retired — it was scaffolding for getting to a working base, and
[PLAN.md](./PLAN.md) is now a live work queue instead. The numbering below is
kept as the historical record of what was built, in what order, and why.

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
   `--card-accent` overrides it when set. `components/Popover.tsx` is a
   generic, board-agnostic portal-based popover (portalled to
   `document.body` so it escapes the column's own scroll clipping);
   `ColorSwatchPicker` and `IconPicker` build on it, and `CustomizePanel`
   combines the two for both `ListColumn` and `CardItem` to open. Icons are
   one inline `<symbol>` sprite (`IconSprite`, mounted once in `main.tsx`)
   referenced via `<use>`, not an icon library -- the set is fixed and
   small. Numbering was a board setting, off/per-list/continuous, computed
   rather than stored. Two parts of this milestone were later revised in
   milestone 9, below: how a card's colour renders, and whether numbering
   is a choice at all -- kept here as what milestone 7 actually built, not
   silently rewritten.)*
8. **Persistence and undo/redo.** *(Complete: `domain/persistence.ts` defines
   the versioned `PersistedBoardV1` shape and validates/migrates it back into
   a `BoardState`, returning `null` for anything unreadable rather than
   throwing; `store/persistBoard.ts` is the only place that touches
   `localStorage`, reading it once at store creation and writing it back
   debounced (400ms) through a subscriber outside the component tree.
   Undo/redo reuses a fact the store already had: every action's `set` call
   already returns a *patch* -- only the slices it touched, with every other
   slice at its old reference, per the normalisation rule above. `domain/
   history.ts`'s `pushEntry` captures the same slices' prior values as
   `before` at zero extra cost (they're the references already sitting in
   state) and stores `{ before, after }` on a bounded stack, so undo/redo
   needed no per-action-type inverse logic, no snapshot of the whole board,
   and no import of anything beyond `BoardState`. `boardStore.ts`'s
   `withHistory` wraps every mutating action in this; `undo`/`redo`
   themselves bypass it, applying a stored patch directly, or undoing would
   recursively push a fresh "undo of the undo" entry. The `history` field
   lives on the store but outside `BoardState`, and is excluded from both the
   persistence subscriber's change check and the serialized payload -- it is
   a live-session convenience, not saved content, so a reload starts with a
   clean stack on top of the restored board. Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z
   are wired in `useUndoRedoShortcuts`, which steps aside when the event
   target is a text field or `contenteditable` so a card or list title still
   being typed keeps the browser's native field-level undo instead of the
   board's.)*
9. **shadcn/ui, card rework, and multi-board support.** A run of explicit
   requests grouped into one milestone rather than one feature. *(Complete.)*
   - *shadcn/ui:* Tailwind CSS v4 and all 62 shadcn/ui components
     (Radix-based) now live in `src/components/ui/`, for future non-board UI
     — the board engine itself still hand-writes CSS Modules against
     `tokens.css`, unchanged. `global.css`'s `@theme inline` block maps
     every shadcn semantic colour to an existing `tokens.css` variable
     rather than the CLI's scaffolded second palette, which was deleted;
     `--radius-sm/md/lg` stay owned by `tokens.css` too, since unlayered
     rules cascade over Tailwind's and shadcn's `@theme` output regardless
     of source order. No shadcn variable name was allowed to collide with
     an existing `tokens.css` one -- `--accent` in particular means
     different things in each system (our brand blue vs. shadcn's
     hover-surface colour), so the bridge keeps them distinct.
   - *Card colour:* `CardItem.module.css`'s `.card` now tints its whole
     background -- `linear-gradient(var(--card-tint), var(--card-tint))`
     layered over the opaque `--surface-raised` base, where `--card-tint` is
     `color-mix(in oklab, var(--card-accent, var(--list-accent, transparent))
     45%, transparent)` -- rather than the milestone 7 left border. The
     layering (a translucent overlay, not a mix into the base colour
     directly) matters because `--list-accent` is *always* defined, even to
     `transparent`, on the column element (so `var(--list-accent)` never
     needs a fallback elsewhere); mixing that straight into the background
     would have shaved visible alpha off every uncoloured card. 45% is the
     strongest wash that still clears WCAG AA (4.5:1) text contrast for
     every palette colour, yellow (the brightest) included.
   - *Card content:* `Card` carries `description` and `postgameDescription`
     -- "pregame thots" / "postgame thots" in the UI -- each edited in place
     on the card via `InlineEditable`'s new `multiline` mode, not through
     `CustomizePanel`. A ⇄ button on the card flips which one is showing;
     both are collapsed by default so neither inflates card height until
     opened. `InlineEditable`'s multiline mode differs from its original
     (title-only) behaviour in three ways: Enter inserts a newline instead
     of committing, an empty commit is allowed (that's how a field is
     cleared) instead of being rejected, and the textarea does not
     select-all on open -- it places the caret at the end instead, since
     select-all on a paragraph turns the next keystroke into a full replace
     rather than a continuation.
   - *Cards lost their icon:* `Card.icon` and `setCardIcon` are deleted;
     `CustomizePanel`'s Icon section is now conditional on `onIconChange`
     being passed, so `CardItem` (which stopped passing it) simply gets a
     Colour-only popover while `ListColumn` is unaffected.
   - *Numbering, simplified:* `NumberingScope` and `BoardSettings` are
     deleted from `domain/types.ts`. `computeCardNumber` no longer takes a
     scope -- every card is numbered within its own list, unconditionally.
   - *Multiple boards:* a board's own content (`BoardState`) is now one of
     several, tracked by a separate, much smaller registry document
     (`BoardId` + `BoardSummary[]` + which one is active) persisted at its
     own `localStorage` key, independent of any board's content key. The
     store gained `boardId`/`boards` fields and `createBoard`/`switchBoard`/
     `renameBoard` actions, none routed through `withHistory` -- switching
     boards is not an undoable edit, and each resets the undo stack, since
     history was already excluded from persistence and switching context
     entirely makes an inherited stack meaningless. `BoardSwitcher.tsx`
     (the board name via `InlineEditable`, a shadcn `DropdownMenu` to switch
     or create) replaces the page header's old static title. A
     pre-multi-board install's single board migrates into the registry as
     board one on first load, written immediately (not through the normal
     400ms debounce) so the id minted for it is stable across a reload
     before any edit would otherwise trigger a save.
   - *Drag-overlay parity:* the `DragOverlay` copy (milestone 4) had never
     been updated for colour or the thots label, so picking up a card
     visibly stripped both. It now receives the dragged card's `listId` (via
     `activeDrag`) and sets `--card-accent`/`--list-accent` itself, since the
     overlay is portalled outside the list's DOM subtree and can't inherit
     `--list-accent` by CSS cascade the way the real card does.

## Since milestone 9

Un-numbered, smaller changes landed after the milestone-9 grouping above.

- **Card trash.** `deleteCard` no longer erases a card -- it moves the card's
  id out of `cardOrder` and into a new `trash: TrashEntry[]` on `BoardState`
  (`domain/trash.ts`), where `TrashEntry` is `{ cardId, listId, deletedAt }`.
  The card's own record stays in `cards`, untouched, so restoring
  (`restoreCard`) is just re-inserting the id at the end of `cardOrder[listId]`
  -- no reconstruction. `trash` is capped at `TRASH_LIMIT` (20); past that the
  oldest entry is forgotten for real, `cards` record included. Both
  `deleteCard` and `restoreCard` go through the existing `withHistory` wrapper
  unchanged, so Ctrl+Z already covered this for free -- the only genuinely new
  code is the trash itself and the panel that shows it. `TrashPanel.tsx` is a
  small, deliberately unobtrusive icon button in the header (opens a shadcn
  `Dialog`) -- supporting chrome, not the board engine, so it's Tailwind +
  shadcn/ui like the rest of the app's chrome rather than a CSS Module.
- **List trash.** Deleting a *list* moves it, as a whole, into a second,
  independent trash -- `trashedLists: TrashedListEntry[]` on `BoardState`,
  where `TrashedListEntry` is just `{ listId, deletedAt }`. Unlike a trashed
  card, a trashed list's own `lists` record, its `cardOrder` entry and every
  card in it are all left completely alone -- the only thing that changes is
  `listOrder` losing the id -- so `restoreList` needs no reconstruction
  either, and a restored list brings its cards back with zero extra
  bookkeeping. This superseded an earlier version of list-delete that
  cascaded each card into the *card* trash individually, restore disabled
  since the list was a hard delete; that approach is gone now that the list
  itself is soft-deletable and can carry its cards back whole. Capped
  separately at `LIST_TRASH_LIMIT` (10, lower than the card trash's 20,
  since one list can carry many cards with it), evicting the oldest for
  real -- list, `cardOrder` entry and cards together -- via a shared
  `forgetList` helper in `domain/trash.ts`. A card trashed individually
  (via its own × button) while its list is still on the board is unaffected
  by any of this; `restoreCardFromTrash` now checks `listOrder.includes`
  rather than mere existence in `lists`, since a list's record can exist
  while the list itself sits in the list trash -- restoring such a card is
  correctly disabled until the list itself is restored (or forgotten, if
  neither ever happens, since the card then sits in the card trash pointing
  at a list that may later vanish for good with no cross-references to
  clean up). `TrashPanel.tsx` renders both trashes as two sections --
  "Lists" and "Cards" -- in the one dialog, with one "Empty trash" that
  clears both. `domain/persistence.ts`'s `deserializeBoard` defaults a
  missing `trash` or `trashedLists` to `[]` for boards saved before either
  shipped, rather than bumping `SCHEMA_VERSION` over two additive, optional
  fields.
- **Per-list width, drag-resized from the column's own edge.** `List.width`
  (`domain/types.ts`) is a plain pixel number, not a closed set like colour
  and icon -- a continuous value has no natural vocabulary to snap to.
  `undefined` means the default `--list-width` from `tokens.css`.
  `ListColumn.module.css`'s `.column` reads `width: var(--column-width,
  var(--list-width))`; a width-set list gets `--column-width` written
  directly on the element (same pattern as `--list-accent`). The interaction
  is a thin `.resizeHandle` straddling the column's right border
  (`role="separator"`), grabbed with the Pointer Events API rather than
  dnd-kit -- it's a different gesture (resize, not reorder) on a different
  element (the column edge, not the header dnd-kit's sensors are bound to),
  so the two never contend for the same pointer-down. During the drag, the
  handle mutates `--column-width` on the DOM node directly (`ListColumn.tsx`)
  -- the same "outside React's render cycle" trick dnd-kit itself uses for
  its transforms -- rather than pushing every pixel through the store; a
  live per-pixel store write would both re-render the column every frame and
  push one history entry per pixel. `setListWidths` (plural -- see below)
  commits exactly once, on pointer-up, so a resize is one undo step. Bounds
  (`--list-width-min/max`
  in `tokens.css`, mirrored as plain numbers in the new `styles/layout.ts`
  since the clamp runs in JS against a `clientX` delta) keep a resize from
  producing a column the card layout wasn't built for.
  A double-click on the handle auto-fits instead of resetting -- spreadsheet
  behaviour, and what was actually being asked for once the drag handle
  itself landed: `computeAutoFitWidth` (`ListColumn.tsx`) forces every card
  title (tagged `data-card-title` in `CardItem.tsx`) to `width: max-content`
  in one batched pass (set on all, then read on all, so the batch costs one
  forced layout rather than one per card), takes the widest, and adds the
  card/scroller/column chrome around it -- read live via `getComputedStyle`
  off one real card rather than reimplemented as literals that would drift
  out of sync with `CardItem.module.css` and `ListColumn.module.css`. With no
  cards to measure, it falls back to clearing `width` (the pre-auto-fit
  behaviour, kept as the empty-list case). `ListOverlay` in
  `DragContext.tsx` sets `--column-width` explicitly for the same reason
  `CardOverlay` already did for `--list-accent`: dnd-kit portals the drag
  overlay to the document root, outside the column's DOM subtree, so neither
  property reaches it by cascade. This replaced an initial three-preset
  `WidthPicker` in `CustomizePanel` (normal/wide/wider buttons) once it
  became clear direct manipulation was the actual ask -- a menu adds a step
  a drag handle doesn't need.
- **Alt and Shift apply a resize or auto-fit to every list at once, two
  different ways.** Holding either while dragging or double-clicking any
  column's resize handle (`ListColumn.tsx`) reaches every column via
  `getAllColumns` -- a plain `document.querySelectorAll("[data-list-id]")`
  rather than a ref registry threaded between sibling `ListColumn`
  instances, since every column already carries that attribute for other
  reasons -- but the two modifiers disagree about what "every column" should
  end up at:
  - **Alt** keeps each column's own size as the baseline: a drag offsets
    every column by the same pixel delta (so columns that started at
    different widths stay different, just all wider or narrower), and a
    double-click auto-fits each to its own cards independently (so they can
    still land on different widths, each tight to its own content).
  - **Shift** makes every column match the *grabbed* column's width exactly,
    unmeasured -- a drag sets every column's `--column-width` to the same
    live value tracking the pointer (not each column's own start plus delta,
    the one thing that would keep them apart), and a double-click just
    copies that column's current rendered width onto every other one. This
    is the "make them all the same size" case, and it needed its own branch
    precisely because Alt's per-column-relative math can't produce it.

  `setListWidths` (plural) on the store applies every affected list's new
  width in one `lists` patch, so a modified gesture touching ten columns is
  still one undo step, matching the single-column case (a one-entry update
  when neither modifier is held). It's the only list-width action now -- an
  earlier, singular `setListWidth` was folded into it once every call site
  needed the plural form anyway.
- **Board zoom.** `ZoomControls.tsx` is the Excalidraw-style `[- 100% +]`
  pill in the toolbar; `BoardCanvas.tsx` owns the zoom level as local
  `useState` (view state, not board data -- it doesn't belong in the
  normalised store or in undo history) and applies it as `transform:
  scale()` on `.rail`, the same node the lists lay out in. This is safe
  with dnd-kit for a reason worth writing down: collision detection and the
  `DragOverlay` both read real `getBoundingClientRect()` values, which
  already reflect the ancestor's CSS transform, and the overlay itself is
  portalled to `document.body`, outside `.rail`, so it tracks the pointer
  in real screen pixels regardless of zoom. No dnd-kit modifier or
  coordinate correction was needed. Range is clamped 50%-200% in 10%-steps
  (`clampZoom` in `ZoomControls.tsx`); clicking the percentage resets to
  100%, matching Excalidraw.
- **Copy a list as an image.** `ListColumn.tsx`'s "Copy list as image"
  button rasterises the column with `html-to-image`'s `toBlob` at
  `pixelRatio: 4` and writes it straight to the clipboard via
  `navigator.clipboard.write`, for pasting into an external tool (the
  motivating case: dropping a list into Excalidraw as reference and
  resizing it there). The 4x oversampling is what keeps that resize from
  looking soft -- a plain 1x screenshot has no spare pixels to lose. Every
  button and the resize handle carry `data-capture-exclude="true"`, and
  `toBlob`'s `filter` option skips them, so the exported image is the
  list's content, not its own chrome. Per-card buttons need no such
  handling: they're already `opacity: 0` except on `:hover`, and the
  capture runs with the pointer over the list's header, not any card.
- **Copy the whole board as an image.** `CopyBoardButton.tsx` (toolbar,
  beside Shortcuts) captures the rail -- every list side by side -- through
  the same `copyAsImage` helper the list button uses (`copyAsImage.ts`), so
  the two share one capture path and one exclude rule. Differences: the
  rail is rendered at `zoom: 1` (via `toBlob`'s `style` override) so the
  image doesn't depend on the current zoom, the add-list composer is tagged
  `data-capture-exclude`, and `pixelRatio` drops below 4 for a very wide
  board to stay under the browser's ~16k-pixel canvas limit rather than
  produce a blank image.
- **Save the board as a PNG or PDF file.** `SaveBoardButton.tsx` (toolbar)
  opens a "Save to…" dialog whose two cards download the same full-rail
  capture as a file (`saveBoard.ts`). `copyAsImage.ts` was split so
  `renderToCanvas` is shared by copy and save; save adds an opaque
  `backgroundColor` (taken from the first opaque ancestor, since the rail is
  transparent and JPEG would render black) and uses `pixelRatio` 2 rather than
  4 -- a file is kept, not pasted. The PDF is one page holding one JPEG,
  written by hand in `imagePdf.ts` (five objects and an xref table) instead of
  adding a PDF library. It is a picture, not selectable text.
- **Duplicate list.** Reached by right-clicking a list's header, not a
  button: the header was out of room, and duplication is occasional. The
  pure `domain/duplicate.ts` copies the list and gives every card a fresh id
  (unlike `duplicateBoard`, cards cannot be shared between lists, since
  membership lives in `cardOrder`), inserting the copy right after the
  original. It returns a normal patch, so one duplication is one undo step.
  The `ContextMenu` wraps only the `<header>` and its content portals out,
  so menu clicks never bubble through the header's drag listeners.

- **A list holds at most 50 cards (v0.0.31).** Boardkit is many boards of
  short lists, so the ceiling is a product rule, not a performance
  workaround. It lives in `domain/limits.ts` (`MAX_CARDS_PER_LIST`,
  `isListFull`) because three separate actions can put a card into a list,
  and each one checks it there rather than trusting the UI: `addCard` and
  `moveCardBetweenLists` return the state unchanged, and
  `restoreCardFromTrash` returns `null` (the card stays in the trash).
  During a drag a full list opens no gap, and the card stays in its own list;
  `DragContext`'s drop handler only commits a reorder when the card it lands
  on is in the dragged card's own list, so a refused drop leaves no empty
  undo step. The UI side is a boolean selector (`useIsListFull`), which
  re-renders only when a list crosses the limit: the "Add a card" composer
  gives way to a short note, and the trash's restore button is disabled with
  a tooltip. Duplicating a list is exempt, since the copy is never bigger
  than the original. Boards saved before the limit that already hold more
  than 50 are not trimmed; they just can't grow.

## Decisions

- **Vite + React + TypeScript.** Fast HMR matters when tuning drag feel.
- **Zustand over Context/Redux.** Context re-renders every consumer on any
  change, which is fatal for a board with hundreds of cards. Zustand gives
  per-selector subscriptions with almost no ceremony.
- **dnd-kit over react-beautiful-dnd.** Actively maintained, sensor-based
  (pointer, keyboard, touch), and applies drag transforms outside React's
  render cycle.
- **The board engine stays CSS Modules + CSS custom properties.** Drag
  choreography and runtime-customisable colours are the two hardest things
  to express in build-time utility classes; both are native to custom
  properties. This no longer rules Tailwind out project-wide (see below),
  only for the board itself.
- **Tailwind CSS v4 + shadcn/ui for everything else (milestone 9).** Added
  once there was non-board UI worth not hand-rolling (menus, dialogs, form
  controls). `tokens.css` stays the one source of visual truth: shadcn's
  semantic colours are bridged to it via `@theme inline` in `global.css`
  rather than living as a second, parallel palette.
- **A board's content and the board registry are two separate persisted
  documents (milestone 9).** Content can grow to hundreds of cards; the
  registry is always just an id and a name per board. Keeping them apart
  means listing boards for a switcher never has to load any board's
  content, and switching boards is a matter of pointing at a different
  content key, not restructuring one large document.
- **A card kept colour but lost the icon picker (milestone 9).** Colour was
  the customisation people actually reached for; the icon picker sat there
  unused. Lists keep both -- nothing suggested the same was true there.
- **Board rotation: duplicate, backup file, delete (v0.0.23–0.0.25).** Boards
  are made weekly and live only in one browser's `localStorage`, so three
  things were added around the multi-board registry:
  - *Duplicate* (`duplicateBoard`) copies the active board under a new id and
    shares the immutable `lists`/`cards` references rather than deep-cloning
    them; trash is not carried over. It writes the new board to storage
    itself, because the persistence subscriber only fires when a content
    slice changes reference and a straight copy changes almost none.
  - *Backup* is a third persisted document, `boardkit-backup` (`domain/
    persistence.ts`), meant for the user to keep rather than the app. Import
    is add-only: a board whose id already exists is skipped, so it never
    overwrites and re-importing the same file is idempotent. Each board goes
    through `deserializeBoard`; one bad board rejects the whole file, which
    costs nothing because import replaces nothing. Non-active boards are
    written straight to storage by `addBoards` for the same reason as above.
    `features/board/backup.ts` reads the active board from the live store,
    not storage, so a failed write cannot drop it from its own backup.
  - *Delete* removes only the active board and refuses to remove the last
    one. There is no board-level trash, so the UI confirms first and points
    at export. The switcher lists boards newest-first by reversing creation
    order at render time; nothing is stored for ordering.
