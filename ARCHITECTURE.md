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
   are entries in the shortcut registry (`features/shortcuts/registry.ts`),
   which steps aside when the event target is a text field or `contenteditable` so a card or list title still
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
- **New board from a board's layout (v0.0.32).** The switcher's "New board
  from these lists" makes a board with the current lists (title, colour,
  icon, width, order) and no cards, named through the same `NewBoardDialog`
  as "+ New board". The pure `layoutOnly` in `domain/duplicate.ts` builds it
  by walking `listOrder`, not `state.lists`: that record still holds trashed
  lists, which must not come along. List ids are reused, as `duplicateBoard`
  already does across boards. The `createBoardFromLayout` store action
  copies `duplicateBoard`'s bookkeeping -- `flushPersist()` first (the
  source may have an edit inside the 400ms save window), then immediate
  writes of the new board and registry, and `EMPTY_HISTORY`.
- **Move or copy to another board (v0.0.33).** A card has a "->" button in its
  hover row (a dropdown: Move/Copy to board > board > list); a list has the
  same two items in its header's right-click menu (Move/Copy to board >
  board). Only the active board is in the store, so `store/transferToBoard.ts`
  does the cross-board work on the target's saved JSON: `flushPersist()`
  (a board left <400ms ago may have edits pending), `loadPersistedBoard`,
  a pure function from `domain/transfer.ts` (`insertCardCopy`,
  `insertListCopy`; fresh ids via `copyCard`, now shared with
  `duplicateList`), then `savePersistedBoardNow`. A `null` load is
  never written over -- it returns an error the UI shows as a toast. A card
  copy into a full list (`isListFull`) is refused twice: the picker greys
  it out and `insertCardCopy` returns `null`. A *move* is copy-then-trash:
  the store's `sendCardToBoard`/`sendListToBoard` call the ordinary
  `deleteCard`/`deleteList` only if the copy succeeded, so Ctrl+Z affects
  just this board (undoing a move restores the original here and leaves the
  copy on the other board; there is no cross-board undo). Target list names
  are read when a submenu opens, not held in state. The menus are shadcn
  (supporting chrome); their content stops `keydown`/`pointerdown`/
  `contextmenu` bubbling, because React events cross the portal into the
  card's `<article>` where dnd-kit's key listeners and the right-click
  thots toggle live. `<Toaster />` is now mounted in `App.tsx`.
- **Backup reminder (v0.0.35).** Boards live only in one browser's
  `localStorage`, so the board menu now shows "Last backup: 9 days ago · Back
  up now", and the switcher's ▾ gets an orange dot when there has never been
  a backup or the last is over 7 days old. `lastBackupAt` is per browser, not
  per board, so it sits in its own zustand store (`store/backupStore.ts`)
  under its own `localStorage` key and is written by every successful export.
  The staleness and age-wording rules are pure functions in
  `domain/backupStatus.ts` (they take `now` as an argument); `useNow` in
  `hooks/` re-renders the text as time passes.
- **Automatic backup to a folder (v0.0.36).** Chrome/Edge only (File System
  Access API; the menu items are hidden elsewhere). "Automatic backup…"
  picks a folder; the handle is kept in IndexedDB through `store/idb.ts`, a
  small key-value module written to be reused (the backgrounds plan needs
  one). `features/board/autoBackup.ts` is the engine: it subscribes to the
  same board slices as persistence plus `boards`/`boardId`, waits 10s of
  quiet, then writes `boardkit-backup-YYYY-MM-DD-HHMM.json` in the exact
  "Export all boards…" format and deletes files beyond the newest 20 -- only
  after a successful write, and only files matching that name pattern. It
  skips a write whose boards equal the last one written, so switching boards
  does not burn rotation slots on duplicates. Status
  (`off | active | needs-permission | folder-error | unsupported`) lives in
  `backupStore`; after a browser restart the saved handle reports "prompt"
  until the user clicks "Resume backups" (`requestPermission` needs a click).
  `collectBoards()` no longer swaps an unreadable board for an empty one: it
  returns it in `unreadable`. Automatic backup then writes nothing and shows
  a warning (otherwise rotation would push every good copy out); manual
  export leaves that board out of the file and toasts. This does not add the
  repair-on-load behaviour queued in `PLAN.md` item 5; it only stops backups
  from hiding the problem. Pure rules (staleness, age text, filename,
  rotation, dot) are in `domain/backupStatus.ts`.
- **Clickable links in thots (v0.0.37).** A web address in a pregame or
  postgame thot shows as a link when the thot is not being edited; editing
  still shows the raw text. Finding links is `domain/links.ts` (pure):
  `splitLinks` cuts a string into `text`/`link` segments (joining them gives
  the original back), `linkLabel` shortens the visible text. Every candidate
  goes through `new URL()` and only `http:`/`https:` survive, so
  `javascript:` and `data:` never become links; a trailing `.,;:!?` is left
  out, and a closing bracket only when it has no opener in the match.
  `InlineEditable` got an opt-in `linkify` prop (only the two thots pass it;
  titles do not, since a title click renames). When a value contains links
  its read-only view is a `div role="button"` rather than the usual
  `<button>`, because an `<a>` cannot be nested in a button; values without
  links render exactly as before. The link's click stops propagating, so it
  opens without entering edit mode, and the div ignores Enter/Space that
  bubble up from a focused link. Links are `draggable={false}`; dnd-kit's 4px
  activation distance keeps a plain click from starting a drag, and a real
  drag that starts on a link still moves the card. The link colour is
  `--text-link` (body text colour) with an accent underline
  (`--text-link-underline`): a blue link text failed WCAG AA on the yellow,
  teal and green card tints (2.6-3.6:1), body text clears it everywhere.
- **Marquee select, copy and paste of cards (v0.0.38).** Dragging on empty
  canvas draws a box and selects every card it touches; the selection stays
  after release and a floating bar offers Copy. Shift-drag adds to the
  selection, a click on empty canvas or Esc clears it. Copied cards can be
  pasted with a "Paste N cards" button (with a × that forgets the copy, as does Esc once nothing is selected) at the bottom of each list, or Ctrl+V
  into the list under the pointer. Cards only for now; lists are not
  selectable. Where things live:
  `store/selectionStore.ts` is a second Zustand store for the selection and
  the clipboard -- transient UI state, so it stays out of `boardStore`'s
  history and persistence, and the clipboard survives a board switch (paste
  into another board works). A card reads `useIsCardSelected(id)`, a boolean,
  so a marquee re-renders only the cards it gains or loses. The store prunes
  ids that leave the board (deleted cards, board switch).
  `domain/clipboard.ts` (pure) holds the rules: `cardsInBoardOrder` (copy in
  board order, dropping trashed cards) and `pasteCardsIntoList` (fresh ids via
  `copyCard`, bottom of the list, cut off at the 50-card limit -- the button
  says "Paste 2 of 5 cards" when it will). `boardStore.pasteCards` puts it in
  `withHistory`, so a paste is one undo step. The marquee itself is
  `features/board/useMarqueeSelection.ts`: it writes the box's transform and
  size straight to a fixed-position div (no React state per pointer move, like
  the column resize) and hit-tests live `getBoundingClientRect`s, clipping each
  card to its list's scroller so a card scrolled out of view is not selected.
  It ignores presses on cards, headers and controls, on the scrollbar, and on
  anything portalled out of the canvas (React bubbles those events through the
  tree). dnd-kit is untouched: its sensor only listens on cards and headers.
  Ctrl+C/V/Esc are entries in the shortcut registry (see below).

- **Keyboard shortcut system.** One registry, one listener, one help dialog,
  all in `features/shortcuts/`. Adding the 30th shortcut is one line in
  `registry.ts`'s `SHORTCUTS` array, written with a `global(...)`,
  `card(...)` or `list(...)` helper: `{ id, keys, label, run }` plus
  optional `whileTyping` (fire in a text field; off by default), `allowRepeat`
  (fire on key-hold; off by default, on for focus movement) and `when` (an
  extra condition -- while false the entry is skipped and the browser keeps
  the key, which is how Ctrl+C still copies text when no card is selected).
  Keys are strings (`"n"`, `"shift+n"`, `"mod+z"`, `["e", "f2"]`; `mod` is
  Ctrl or Cmd), parsed once in `keys.ts`. Nothing else needs editing: the help
  dialog (`ShortcutsDialog.tsx`) renders `SHORTCUTS` grouped by scope, so it
  cannot drift from what works, and only the mouse gestures, typing keys and
  dnd-kit's own keyboard drag are listed by hand. Design decisions:
  - **Scopes.** `global` fires anywhere; `card` needs a card element itself
    focused; `list` needs a list header focused. Focus is read from the DOM
    (`dom.ts` `focusTargetOf`, off `data-card-id`, `data-list-header` and
    `data-list-id`) -- dnd-kit already makes both focusable, so "the focused
    card" needs no state. Focus on a button *inside* a card is not "a card
    focused", so that button keeps its own keys. A narrower scope is checked
    before `global`.
  - **One listener** (`useShortcuts.ts`, mounted in `BoardCanvas`) writes the
    two rules that hold for every shortcut once: typing is sacred, and during
    a keyboard (or pointer) drag it stands aside. A drag is detected by the
    `aria-pressed` dnd-kit puts on the dragged card or header.
  - **Clash check.** `findClashes` runs at module load in dev and
    `console.error`s two entries with the same keys in the same scope.
  - **Focus movement** (`navigation.ts`) walks `cardOrder`/`listOrder` from the
    store and only calls `.focus()`; left/right picks the card in the
    neighbouring list whose vertical middle is closest, skipping empty lists.
    Arrow keys also connect cards and headers (up from the first card, down
    from a header) so `D` is reachable without tabbing through every button.
  - **Some actions press the existing button** rather than duplicating its
    logic: `T` clicks the card's `data-thots-toggle` (thots open state is
    local to `CardItem`) and `E`/`F2` click the title (start editing is local
    to `InlineEditable`). `N`/`Shift+N` call `addCardAt` (`domain/ordering.ts`
    `insertAt`, 50-card guard, returns the id or `null` -> toast) inside
    `flushSync`, so the new card exists to be pressed, then open it in rename.
  - **Focus comes home.** `InlineEditable` hands focus back to its nearest
    focusable ancestor (the card or header) after Enter/Esc, but not after a
    blur -- so `N`, type, Enter, `N` works with no mouse. It does so in an
    effect after the textarea unmounts; moving focus earlier would blur the
    field and commit twice.
  - `?` opens the dialog through `store/shortcutsDialogStore.ts`, so the
    toolbar button and the shortcut share one open state.
  Not built: remapping keys, a command palette (`PLAN.md`'s "not being built").
  Ctrl/Cmd+K (search, below) is registered here.

- **Search across all boards.** Ctrl/Cmd+K (or the toolbar magnifier) opens a
  shadcn `CommandDialog` (cmdk) with cmdk's own fuzzy filter off
  (`shouldFilter={false}`): matching is ours, in `domain/search.ts`.
  - **Matching is pure.** `searchBoards(sources, query)` is a case-insensitive
    substring match on title, pregame and postgame thots. It walks
    `listOrder` then `cardOrder`, never the flat `cards` table, so trashed
    cards and cards in trashed lists (which stay in `cards`) are skipped for
    free. One hit per card (first matching field wins), capped at 100, and an
    empty query returns nothing. `excerptAround` collapses whitespace and cuts
    a snippet around the match; it uses a regex rather than `toLowerCase`
    indices, which drift on characters whose lower-case form has another
    length.
  - **Where the boards come from.** `store/searchSources.ts` (the one place
    that knows): `flushPersist()`, then the active board from the store (so
    edits not yet saved count) followed by every other board via
    `loadPersistedBoard`, newest first. Boards that fail to load are skipped;
    search never writes. It runs once when the dialog opens: `SearchPanel` is
    inside Radix's content, which only mounts while open, so a lazy
    `useState(loadSearchSources)` loads on open and the query resets by
    unmounting -- no effect, no reset code.
  - **Opening a result** calls `switchBoard` if needed, then `revealCard`
    (`features/search/revealCard.ts`): waits (up to ~60 frames) for the
    `data-card-id` element to exist, scrolls it into view, and sets
    `data-found` on it. `CardItem.module.css` turns that into a one-off pulse
    on the card's `::after`: the inset ring and wash are static and the
    keyframes change only `opacity`. The attribute is removed on the pseudo's
    `animationend` (children's animations bubble up, so it checks the target).
    Duration is the new `--duration-highlight` token.
  - Open state is `store/searchDialogStore.ts`, shared by the button and the
    shortcut, like the shortcuts dialog. Not built: a "this board only"
    toggle, filtering the board while typing, auto-opening a card's thots.

- **Special card types (divider, note).** A card can be switched to a type
  from its customise panel's "Card type" choice. It is one optional field,
  `Card.kind` (`domain/types.ts`), absent for a normal card, so old boards
  load unchanged with no schema bump -- the same approach as `trash`.
  - **Rules live in one table.** `domain/cardKinds.ts` holds
    `CARD_KIND_SPECS`: per type, a `label`, whether it is `numbered` and
    whether it `hasThots`. Numbering (`domain/numbering.ts`), search
    (`domain/search.ts`), `CardItem` (the thots button, right-click, thots
    section), `CardOverlay` and `CustomizePanel` all ask `specOf(card)`
    rather than checking `kind === "divider"`.
  - **Adding a type** is: add its name to `CARD_KINDS` (`types.ts`), one row
    in `CARD_KIND_SPECS`, and a `.<name>` class in `CardItem.module.css`
    (`CardItem` applies `styles[card.kind]` on the same `<article>`, so
    drag, buttons and selection all keep working). The panel lists it
    automatically.
  - **Not numbered means not counted.** `computeCardNumber` counts only
    numbered cards, so "1, 2, divider, 3". It now also reads `state.cards`,
    still one primitive per card, so `useCardNumber` keeps its `Object.is`
    bail-out. (Since v0.0.53 numbering is one pass per list, still counting
    numbered cards only -- see "Continued numbering" below.)
  - **Switching type loses nothing.** `setCardKind` (through `withHistory`,
    one undo step) only sets `kind`; colour and both thots stay on the
    record. A type without thots hides them and search skips them; switching
    back shows them again. Copies, duplicates, transfers and trash spread the
    whole card, so they carry `kind` with no extra code.
  - **Unknown `kind`s degrade.** `deserializeBoard` runs `withKnownKinds`,
    which drops a `kind` this build doesn't know (a newer version, a
    hand-edited backup) so the card loads as a normal one. It returns the
    same `cards` object when nothing needs stripping.
  - **Look.** A divider is a heading line: the label is the card's title,
    the 2px line takes the card's colour, else the list's, else a neutral
    border (the label stays `--text-secondary`: mixing a possibly
    `transparent` accent into text drags its alpha down). A note is a dashed,
    small-radius card with an italic label whose wash is the card's own
    colour or `--note-accent` (yellow, new token), ignoring the list's accent.
    Only paint differs; nothing animates beyond what a card already does.
    A lifted divider gets a raised surface (`.divider.overlay`).
  - Every card counts toward the 50-card limit, dividers and notes included
    (the owner's call). Not built: a separate "add a divider" composer, and
    collapsing the section under a divider.

- **Custom colours (v0.0.44).** The swatches in the customise panel gain a
  "+" that opens a shade area, hue slider and hex box (`react-colorful`, ~2 KB,
  restyled onto tokens in `CustomColorPicker.module.css`). Recent picks show
  after the palette. The picker opens inline inside `CustomizePanel` rather
  than as a second popover: the panel's `Popover` closes on any pointerdown
  outside itself, and a portalled second popover would count as "outside".
  - **Data.** `color` on `List` and `Card` is `ItemColor = PaletteColor |
    HexColor` (`domain/types.ts`); `HexColor` is a branded lowercase
    `#rrggbb` that only `parseHex` (`domain/colors.ts`) can produce. Old
    boards hold palette names, which stay valid, so no schema bump.
    `deserializeBoard` runs `withKnownColors` over lists and cards: `#FFF`
    is normalised, anything unreadable is dropped to "no colour", never a
    failed load. Backups, transfers and search all load through it.
  - **CSS.** `accentCss(color)` returns `var(--palette-x)` or the hex, and is
    written to the same `--card-accent` / `--list-accent` properties as
    before, so the tint, divider line and drag overlay needed no changes.
    User colours are never filtered or transformed (Excalidraw's "picked
    colour isn't the colour I see" bug).
  - **Readable text.** `cardInk` (`domain/colors.ts`) blends the accent at
    45% over the card surface, exactly as `--card-tint` paints it, and if
    the theme's text falls below 4.6:1 (4.5 plus a rounding margin) switches
    the card to white or black -- the only pair that reaches 4.5:1 on every
    background. `inkOf` (`domain/cardKinds.ts`) supplies the effective accent
    (a note ignores its list's colour; a divider has no tinted background).
    The result is a `data-ink` attribute; `CardItem.module.css` re-points the
    text tokens (and `color`, and `--text-link`, which was resolved at :root)
    for that card. Palette colours never switch. The JS mirrors of the
    surface/text tokens are in `styles/surfaces.ts`, like `motion.ts`.
    Lists don't switch: a 25% tint of even pure white leaves ~7:1 for the
    theme's text.
  - **One drag, one write.** While the picker is dragged or a hex typed, the
    colour is a *preview*: `CustomizePanel` holds a draft and the owner
    (`CardItem`, `ListColumn`) shows it through local `previewColor` state,
    so previewing never touches the store, undo stack or disk. The draft is
    saved once, when the panel closes or a hex is confirmed with Enter.
    Escape (seen in a capture-phase listener, before `Popover`'s own handler
    closes and would save) discards it. Palette and recent swatches save
    immediately, as before. A bad hex gets a red outline and a message on
    blur/Enter and changes nothing.
  - **Recent colours** (`store/recentColorsStore.ts`): last 8, per browser in
    `localStorage`, not per board, and outside undo history. Each one has a
    small × on hover or keyboard focus (`forget`) that removes it from the
    list only; lists and cards already using it keep the colour, and a saved
    colour that isn't in the list still shows as a swatch, without a ×. The
    palette swatches have no ×: they are fixed.

- **Blank titles (v0.0.47).** Card and list titles may be empty. The store
  never enforced otherwise; the rule lived in two UI components. `Composer`
  now submits an empty draft (Escape, blur and × still close without adding),
  and `InlineEditable` gained an `allowEmpty` prop -- passed by card and list
  titles, withheld by the board name, which the switcher needs something to
  show for. A blank title's button is kept one line tall by
  `.display:empty::before` (a zero-width space), so it is still clickable and
  the drag overlays do the same in JS. Places that print a title in a
  sentence (delete dialog, trash, search, transfer menus) fall back to
  "Untitled list" / "Untitled card".

- **Light theme (v0.0.48).** Dark / Light / System, per browser.
  - **Tokens, not components.** `tokens.css` keeps the dark values on `:root`
    and gains `:root[data-theme="light"]`, which overrides only the neutral
    tokens (surfaces, borders, text, accent, shadows) under the *same names*.
    No component changed its CSS. shadcn follows for free through the
    `@theme inline` bridge. The palette, `--note-accent` and the ink pair are
    deliberately not themed: an accent must read as the same colour on both.
    `color-scheme` flips with it so native scrollbars and inputs match.
  - **No flash.** A tiny inline script in `index.html` sets `data-theme` (and
    shadcn's `.dark` class) from `localStorage["boardkit:theme"]` before first
    paint. `store/themeStore.ts` then owns it: it keeps the choice, the
    attribute, the class and the resolved theme in step, and follows the OS
    live while the choice is System. `domain/theme.ts` is the pure half
    (`resolveTheme`).
  - **Contrast is theme-aware.** `cardInk` / `inkOf` now take the resolved
    theme and read that theme's card surface and text from
    `THEME_SURFACES` (`styles/surfaces.ts`, the JS mirror of the tokens).
    `CardItem` and the drag overlay read `useResolvedTheme()`. Every palette
    colour clears 4.5:1 at the existing 45% tint on both themes (worst case:
    yellow on dark, 4.87; purple on light, 8.18), so the tint strength did
    not need a per-theme token.
  - **Nothing animates on switch.** The theme change is one attribute flip;
    no `transition` is added on colours.
  - `dark:` classes in shadcn components now activate in dark mode (they
    never did before, because no `.dark` class existed). They resolve through
    the same bridged tokens. The toaster is given the resolved theme
    explicitly, since it would otherwise read `next-themes`, which nothing
    provides.

- **Board background colour (v0.0.49).** Each board can have a colour behind
  its lists, set from the board menu's "Background…".
  - **Data.** `BoardState.background?: BoardBackground`, a tagged union that
    today has one member, `{ kind: "color", color: ItemColor }` (palette name
    or hex), so the image variant is a new member, not a change. Optional, so
    old boards load unchanged. `domain/background.ts` cleans it on load
    (`knownBackground`): anything unreadable degrades to "no background".
    `persistence.ts`'s content picker is now exported as `boardContent` and is
    the only place that lists a board's saved fields (backup export uses it
    too); `background` is always present as a key, because a loaded board is
    spread over the live store and a *missing* key would leave the previous
    board's background showing. Duplicate board and "new board from these
    lists" carry it over.
  - **Undo.** `setBackground` goes through `withHistory` like any edit.
    Picking a custom colour is one drag = one write: `useColorDraft`
    (extracted from `CustomizePanel`, now shared) previews live and saves once
    when the panel closes or a hex is confirmed; Escape discards. The preview
    lives in `store/backgroundPreviewStore.ts`, never in the board store.
  - **Rendering.** `BoardBackdrop` is a separate layer behind the lists
    (`z-index: -1` in an isolated canvas), subscribed to the background alone,
    so a picker drag repaints one element and re-renders no list. The colour is
    the `--board-background` custom property. It applies as-is in both themes:
    an explicit user choice, and lists and cards sit on their own surfaces.
  - **Readable chrome.** Only controls with no surface of their own sit on the
    background: the toolbar icons and "Add a list". `chromeOnColor`
    (`domain/colors.ts`) leaves them alone while the theme's dimmer text
    reaches 4.5:1 on the colour; otherwise it picks pure black or white text
    (always >= 4.58:1; mid-tones like blue need it, neither scheme's own text
    clears 4.5:1) plus the scheme whose surfaces suit it. Applied as
    `data-scheme` / `data-ink` on just those elements. `tokens.css` now
    declares the neutral tokens for `[data-scheme="dark|light"]` as well as
    the root theme, so any subtree can force a scheme; lists and cards never
    do. `PALETTE_HEX` in `styles/surfaces.ts` mirrors the palette for this.
  - **Export.** The backdrop is not inside the captured rail, so PNG/PDF save
    and copy-as-image fill behind it explicitly (`exportBackground.ts`). Copy
    stays transparent when the board has no background, as before.

- **Board background image (v0.0.50).** "Background…" also takes a picture,
  with a dimming slider. The third `BoardBackground` variant is
  `{ kind: "image", imageId, wash, average }`.
  - **Storage.** `localStorage` holds about 5 MB for the whole app, so the
    picture is never on the board: it is a `Blob` in IndexedDB
    (`store/imageStore.ts`, on the existing `store/idb.ts` key-value store,
    keys `boardImage:<id>`), and the board keeps only the id. Choosing a file
    goes `prepareBackgroundImage` (`features/board/backgroundImage.ts`: canvas
    resize to at most 2560px, WebP at 0.8 with a JPEG fallback, plus the
    average colour) -> `saveImage` -> only then `setBackground`, so a board
    never points at an image that failed to save. A 6.5 MB test PNG stored as
    290 KB.
  - **A missing image is not an error.** `store/imageUrlStore.ts` caches one
    object URL per image (`undefined` = not looked yet, `null` = not there).
    `useBackdrop` treats `null` as no background at all, so the board and the
    toolbar fall back to the theme's default.
  - **Clean-up has two halves, on purpose.** Deleting a board releases its
    image unless another board still shows it (duplicates share an `imageId`);
    the remaining boards are passed in, because the registry in storage is
    saved on a delay and still names the deleted one. Replacing or removing an
    image does **not** delete it: undo can bring that background straight
    back. `sweepUnusedImages` (run from `main.tsx`) deletes every unreferenced
    image at start-up, when history is empty. Both refuse to delete anything if
    any board fails to load -- that board may use the image.
  - **Backups.** `BackupFileV1` gained an optional `images` record
    (`imageId -> { type, base64 }`), so no version bump and old files still
    import. `buildBackup` is async and includes only images the boards use, once
    each; import writes them back into IndexedDB *before* adding the boards,
    skipping any already stored. Automatic folder backups include them too.
    Backups with images are larger (base64 is a third bigger than the file);
    the panel says so.
  - **Rendering.** Two static layers in `BoardBackdrop`: the picture
    (`background-size: cover`, `will-change: transform`) and a `--surface-app`
    layer whose `opacity` is `wash` -- dark theme dims, light theme lightens,
    and only `opacity` is ever set. The canvas does not scroll (the lists do,
    above it), so scrolling and dragging repaint nothing here; it is not
    `background-attachment: fixed`. Frame times were not measured (the
    browser pane was hidden); the design is what keeps it cheap. The slider
    follows the picker's rule: preview live via `backgroundPreviewStore`, one
    write on release.
  - **Toolbar tone.** A picture has no single colour, so `washedColor` blends
    the stored average toward the theme's page colour by `wash`, and
    `chromeOnColor` picks the toolbar's scheme/ink from that. An average can
    hide a bright or dark corner; toolbar pills keep their own surfaces, so
    only the bare icons are affected.
  - **Export.** The backdrop is not in the captured rail, so
    `exportBackground.ts` `withBackdrop` paints the colour, or the picture
    cropped to cover plus the wash (reading the same `--surface-app`), behind
    it. Saves pass the page colour as a fallback for boards with no background;
    copy passes none and stays transparent.
- **Continued numbering (v0.0.53).** A list can continue the numbering of the
  list to its left instead of starting at 1: right-click its header, or click
  the number on its first card. Its header's count pill then shows the
  range it covers ("5–7") instead of the card count, which moves to the
  pill's tooltip -- no extra header chrome, and it says where the list sits
  in the sequence rather than only that it continues. The list a run starts
  from shows its range too ("1–10"), via `useIsNumberingContinued` -- a
  boolean selector on the next list's flag, so it only re-renders when that
  link changes.
  - **One flag, linked by position.** `List.continuesNumbering` is a boolean,
    not a pointer to another list. The link follows board order, so moving or
    deleting lists can't leave a dangling reference, and chains (C continues
    B continues A) fall out of `numberingOffset` walking left. The leftmost
    list ignores the flag but keeps it, so moving it back restores the link.
    Duplicate and move-to-board copy the flag with the rest of the list.
  - **Numbered per list, not per card.** `useCardNumbers(listId)` returns the
    whole list's numbers in one pass, compared with `useShallow`, and
    `ListColumn` passes each card its number as a prop. This replaced the
    per-card `useCardNumber`, which scanned the list once per card on every
    store update (`PLAN.md` item 1). A card whose number didn't change still
    bails out of `memo`. The cost now is one pass over the list and the lists
    it continues, per list, per update -- short by design.
  - **The number as a toggle.** Only the first numbered card's number is a
    button, with a stable `useCallback` handler so `memo` holds. It stops
    `pointerdown` from reaching the card's drag listeners, so clicking it is
    never the start of a drag.

- **Number styles (v0.0.57).** Card numbers have two independent style
  controls, both optional fields so older boards load unchanged:
  - **Format is per list, emphasis is per card.** `List.numberFormat`
    (plain, padded, hash, roman, letters) sets how every number in a list is
    written, because a sequence only reads as one if it's written one way
    ("1, ii, 3" looks like a bug). `Card.numberEmphasis` (badge, ring, bold,
    muted) picks out a single card without breaking the sequence. Format is
    in the list's customise panel, emphasis in the card's, and the selection
    bar's "Number" menu sets emphasis on every selected card in one undo step
    (`setCardsNumberEmphasis`, which also serves the single-card case).
  - **Text in `domain/`, paint in CSS.** `domain/numberStyle.ts` only turns a
    number into text (`formatNumber`). Emphasis is a `data-number-emphasis`
    attribute on the card, styled in `CardItem.module.css`, the same way
    `data-ink` works. The number's text sits in its own `.numberText` pill, so
    the strip keeps its size and emphasised cards stay lined up.
  - **Long formats widen the strip.** Roman and hash can outgrow the 32px
    strip ("lxxxviii"), so those lists override `--card-number-gutter` with
    `--card-number-gutter-wide` on the column, and every card inherits it
    through CSS. The drag overlay is portalled outside the column, so it sets
    the variable again itself, just as it does for `--list-accent`.
  - The format comes down to `CardItem` as a primitive prop next to `number`,
    so changing it re-renders that list's cards and nothing else.

- **Card highlights (v0.0.58).** A card can wear a border colour of its own,
  set in its customise panel under "Highlight":
  - **Separate from `color`.** `Card.highlight` is its own `ItemColor`, so a
    red-tinted card can still get a blue ring. `Card.highlightStyle` (ring,
    outline, dashed, double, top bar, pulse; absent = ring) is kept when the
    colour is cleared, so turning the highlight back on restores it. Both
    are cleaned on load by `withKnownHighlights` (`domain/highlight.ts`).
  - **Paint only, never size.** Every style is box-shadow or `outline`,
    never border width or padding, so a highlighted card is exactly the size
    of its neighbours and switching styles never shifts the list. The card's
    shadow is `var(--highlight-ring), <whatever else>` everywhere (rest,
    hover, selected, dragging, overlay), so those states stack on top of
    the highlight instead of wiping it. `--highlight-reach` says how far a
    style sticks out, and the selection ring sits just outside that.
  - **Pulse animates opacity only**, on a `::before` overlay drawn once, and
    is held still under `prefers-reduced-motion` (the global rule would
    otherwise shorten the endless loop into a strobe).
  - Dividers have no border to draw on, so `CardKindSpec.highlightable` is
    false for them: the highlight is kept, hidden, and offered again when the
    card switches back to a type that has one.
