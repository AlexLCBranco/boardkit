import { nanoid } from "nanoid";

import type { BoardId, CardId, ListId } from "./types";

/**
 * Id generation, wrapped in one place.
 *
 * Nothing else in the app calls `nanoid` directly. If ids ever need to change
 * shape -- shorter, prefixed, sortable, server-issued -- this is the only file
 * that moves.
 *
 * Ten characters is ample here: the collision risk within a single board is
 * negligible, and shorter ids keep the persisted state small.
 */
const ID_LENGTH = 10;

export function createListId(): ListId {
  return nanoid(ID_LENGTH) as ListId;
}

export function createCardId(): CardId {
  return nanoid(ID_LENGTH) as CardId;
}

export function createBoardId(): BoardId {
  return nanoid(ID_LENGTH) as BoardId;
}

/**
 * Casts for ids that come from outside the generator -- seed data, saved
 * state, tests. Kept explicit so the `as` casts live here and not scattered
 * through the codebase, where they would quietly defeat the branding.
 */
export const asListId = (value: string): ListId => value as ListId;
export const asCardId = (value: string): CardId => value as CardId;
