/**
 * The domain model. Pure TypeScript: no React, no store, no side effects.
 *
 * Everything here describes *what a board is*, independently of how it is
 * rendered or stored. That separation is what lets the ordering rules be
 * tested as plain functions later.
 */

/**
 * Branded (a.k.a. nominal) types.
 *
 * `ListId` and `CardId` are both strings at runtime -- the brand is erased by
 * the compiler and costs nothing. But to TypeScript they are distinct types,
 * so passing a card id where a list id is expected is a compile error rather
 * than a bug that surfaces as an empty column three milestones from now.
 *
 * The `unique symbol` key can never be produced by accident, which is what
 * stops a plain string from being assignable to a branded id.
 */
declare const brand: unique symbol;

type Brand<T, TBrand extends string> = T & { readonly [brand]: TBrand };

export type ListId = Brand<string, "ListId">;
export type CardId = Brand<string, "CardId">;
export type BoardId = Brand<string, "BoardId">;
/** Names a background image kept in IndexedDB (store/imageStore.ts). */
export type ImageId = Brand<string, "ImageId">;

/**
 * The customisation vocabulary.
 *
 * Icons are a closed set rather than an uploaded image: a fixed set is what
 * makes `IconSprite` a handful of inline paths instead of a bundled icon
 * library. Colours started as a closed set too, and now also accept any hex
 * (`ItemColor` below); the palette stays as the quick-pick swatches. The
 * `as const` arrays are the runtime companions to the types -- pickers
 * iterate `PALETTE_COLORS` and `ICON_KEYS` rather than each inventing their
 * own copy of the list.
 */
export const PALETTE_COLORS = [
  "slate",
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "purple",
] as const;
export type PaletteColor = (typeof PALETTE_COLORS)[number];

/** A colour the user picked freely: always `#rrggbb`, lowercase. Only
    `parseHex` (domain/colors.ts) makes one, so a `HexColor` is known to be
    well-formed wherever it turns up. */
export type HexColor = Brand<string, "HexColor">;

/** What a list or card's `color` holds: a palette swatch or a picked hex.
    Old boards only ever contain palette names, so they load unchanged. */
export type ItemColor = PaletteColor | HexColor;

export const ICON_KEYS = ["star", "flag", "bug", "rocket", "bolt", "fire", "heart", "tag"] as const;
export type IconKey = (typeof ICON_KEYS)[number];

/** A column's width, in pixels, dragged freehand from its right edge --
    unlike colour and icon, width has no natural closed set to snap to, so
    it stays a plain clamped number rather than a fixed vocabulary. `undefined`
    means the column uses the default `--list-width` from tokens.css. The
    clamp bounds themselves live in `styles/layout.ts`, mirroring
    `tokens.css`'s `--list-width-min`/`-max` by hand -- same reasoning as
    `styles/motion.ts`'s mirrors: the resize drag computes in JS, which can't
    read a `var(...)`. */
export type ListWidth = number;

/** The special card types. A closed set, like the palette: the rules for
    each live in `cardKinds.ts`. A card with no `kind` is an ordinary one. */
export const CARD_KINDS = ["divider", "note"] as const;
export type CardKind = (typeof CARD_KINDS)[number];

/** How a list writes its card numbers (`domain/numberStyle.ts`). Set per
    list, not per card: mixing formats inside one list ("1, ii, 3") reads as
    a mistake. A list with no format uses plain digits. */
export const NUMBER_FORMATS = ["padded", "hash", "roman", "letters"] as const;
export type NumberFormat = (typeof NUMBER_FORMATS)[number];

/** How one card's number stands out from its neighbours. Per card, so a
    single card can be picked out without breaking the list's sequence. A
    card with no emphasis shows its number the ordinary way. */
export const NUMBER_EMPHASES = ["badge", "ring", "bold", "muted"] as const;
export type NumberEmphasis = (typeof NUMBER_EMPHASES)[number];

/**
 * What is behind a board's lists. Per board, so boards can be told apart at a
 * glance; `undefined` on the board means the theme's own background. A tagged
 * union, so each kind is its own shape.
 *
 * A colour is applied as-is in both themes: it is the user's explicit choice,
 * and the lists and cards sit on their own themed surfaces.
 *
 * An image is *not* stored on the board: boards live in `localStorage`
 * (about 5 MB for the whole app) and one photo would fill it. The board holds
 * only a reference, `imageId`, and the picture itself sits in IndexedDB.
 */
export type BoardBackground =
  | { readonly kind: "color"; readonly color: ItemColor }
  | {
      readonly kind: "image";
      readonly imageId: ImageId;
      /** How strongly the theme's own surface colour is laid over the image
          so the lists stay readable: 0 (none) to `MAX_WASH`
          (domain/background.ts). Dark theme dims, light theme lightens. */
      readonly wash: number;
      /** The image's average colour, measured once when it was chosen. The
          toolbar's text is picked against it, and it is what the board falls
          back on while the picture itself is still loading. */
      readonly average: HexColor;
    };

export interface Card {
  readonly id: CardId;
  readonly title: string;
  /** Absent means a normal card, so boards saved before card types existed
      load unchanged. Switching a card back to normal only clears this field;
      everything else on the card is kept. */
  readonly kind?: CardKind;
  /** A card's only customisation, now that its icon picker is gone --
      colour turned out to be the one anyone actually used. */
  readonly color?: ItemColor;
  /** Shown in the UI as "pregame thots". Kept as `description` -- rather
      than renamed to match -- so boards saved before that label existed
      keep their text; only the second, `postgameDescription`, is new. */
  readonly description?: string;
  /** Shown in the UI as "postgame thots". */
  readonly postgameDescription?: string;
  /** How this card's number stands out (domain/numberStyle.ts). Absent
      means normal. Kept when the card switches to an unnumbered type, so
      switching back restores it. */
  readonly numberEmphasis?: NumberEmphasis;
}

export interface List {
  readonly id: ListId;
  readonly title: string;
  readonly color?: ItemColor;
  readonly icon?: IconKey;
  /** Column width, as a card-line-length control. Undefined means the
      default `--list-width` from tokens.css. */
  readonly width?: ListWidth;
  /** Start card numbers where the list to the left finished, instead of at
      1 (domain/numbering.ts). Absent means false. */
  readonly continuesNumbering?: boolean;
  /** How this list writes its card numbers (domain/numberStyle.ts). Absent
      means plain digits. */
  readonly numberFormat?: NumberFormat;
}

/**
 * The normalised board.
 *
 * Entities live in flat lookup tables; order lives in separate arrays of ids.
 * The two are deliberately kept apart:
 *
 *  - Reading one card is `cards[id]` -- O(1), and a component can subscribe to
 *    exactly that one entry.
 *  - Reordering rewrites one short array of ids. The card objects themselves
 *    keep their identity, so React sees unchanged props and skips them.
 *  - Moving a card between lists is two array operations, not a deep clone of
 *    a nested tree.
 *
 * The alternative -- `List { cards: Card[] }` -- fails all three: every
 * reorder produces a new list object, which produces new props for every card
 * in it, which re-renders the whole column.
 */
export interface BoardState {
  readonly lists: Readonly<Record<ListId, List>>;
  readonly cards: Readonly<Record<CardId, Card>>;
  /** Left-to-right order of the columns. */
  readonly listOrder: readonly ListId[];
  /** Top-to-bottom order of cards, keyed by the list they belong to. */
  readonly cardOrder: Readonly<Record<ListId, readonly CardId[]>>;
  /** Cards deleted via the card delete button, most-recently-deleted last.
      The card itself stays in `cards` -- only its `cardOrder` entry is
      removed -- so restoring is just putting the id back. */
  readonly trash: readonly TrashEntry[];
  /** Lists deleted via the list delete button, most-recently-deleted last.
      Unlike a trashed card, a trashed list's own record, its `cardOrder`
      entry and every one of its cards are all left completely alone -- only
      `listOrder` loses the id -- so restoring is just putting the id back,
      list and cards intact, with no separate bookkeeping for the cards. */
  readonly trashedLists: readonly TrashedListEntry[];
  /** Absent means the theme's default. Optional so boards saved before
      backgrounds existed load unchanged (same approach as `trash`). */
  readonly background?: BoardBackground;
}

/** One card sitting in the trash: which list to put it back into, and when
    it landed there (shown in the trash panel, and used to evict the oldest
    entry once the trash is full). */
export interface TrashEntry {
  readonly cardId: CardId;
  readonly listId: ListId;
  readonly deletedAt: number;
}

/** One list sitting in the trash, and when it landed there. */
export interface TrashedListEntry {
  readonly listId: ListId;
  readonly deletedAt: number;
}

/**
 * One entry in the list of boards a user has created. Just enough to render
 * a switcher -- the board's own content lives in a separate `BoardState`,
 * persisted and loaded independently, so switching boards never has to pull
 * every board's cards into memory at once.
 */
export interface BoardSummary {
  readonly id: BoardId;
  readonly name: string;
}
