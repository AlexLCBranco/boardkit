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

export interface Card {
  readonly id: CardId;
  readonly title: string;
}

export interface List {
  readonly id: ListId;
  readonly title: string;
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
}
