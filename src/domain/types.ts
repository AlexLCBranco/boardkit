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

/**
 * The customisation vocabulary.
 *
 * Both are closed sets rather than free-form strings (a hex value, an
 * uploaded icon): a fixed palette is what makes a runtime colour a single
 * CSS custom property swap instead of a colour-picker widget with its own
 * validation, and a fixed icon set is what makes `IconSprite` a handful of
 * inline paths instead of a bundled icon library. The `as const` array is
 * the runtime companion to the type -- pickers iterate `PALETTE_COLORS` and
 * `ICON_KEYS` rather than each inventing their own copy of the list.
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

export interface Card {
  readonly id: CardId;
  readonly title: string;
  /** Absent means a normal card, so boards saved before card types existed
      load unchanged. Switching a card back to normal only clears this field;
      everything else on the card is kept. */
  readonly kind?: CardKind;
  /** A card's only customisation, now that its icon picker is gone --
      colour turned out to be the one anyone actually used. */
  readonly color?: PaletteColor;
  /** Shown in the UI as "pregame thots". Kept as `description` -- rather
      than renamed to match -- so boards saved before that label existed
      keep their text; only the second, `postgameDescription`, is new. */
  readonly description?: string;
  /** Shown in the UI as "postgame thots". */
  readonly postgameDescription?: string;
}

export interface List {
  readonly id: ListId;
  readonly title: string;
  readonly color?: PaletteColor;
  readonly icon?: IconKey;
  /** Column width, as a card-line-length control. Undefined means the
      default `--list-width` from tokens.css. */
  readonly width?: ListWidth;
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
