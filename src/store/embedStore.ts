import { create } from "zustand";

import { readEmbed, type Embed, type EmbedStatus } from "../domain/embed";

/**
 * Whether this page is a frame on the gauntlet canvas (`domain/embed.ts`),
 * read once from the address as the stores load: the board store's first
 * state depends on it. In embed mode the frame shows one board and never
 * changes which board the full app opens next (the registry's
 * `activeBoardId`), or two frames, and the app itself, would fight over it.
 */
// `globalThis.location`, not `window.location`: tests stand in a `window`
// without one, and outside a browser there is no address at all.
let embed: Embed | null = readEmbed(globalThis.location?.search ?? "");

export const embedded = (): Embed | null => embed;

/** Tests only: the stores read the address once, at load. */
export function setEmbeddedForTests(next: Embed | null): void {
  embed = next;
}

export const useEmbedStatus = create<{ readonly status: EmbedStatus }>(() => ({ status: "ok" }));

export const setEmbedStatus = (status: EmbedStatus): void => useEmbedStatus.setState({ status });

/**
 * The gauntlet whiteboard (`whiteboard/`): embed mode without an address.
 * Called before the board store loads, so it opens no board at all (no
 * first-run seed, nothing written); `openEmbeddedBoard` then opens the one
 * being edited.
 */
export function setEmbedded(next: Embed): void {
  embed = next;
}
