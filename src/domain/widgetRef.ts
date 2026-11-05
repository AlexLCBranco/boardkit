// What Ctrl+C in Boardkit puts on the clipboard when no card is picked (the
// gauntlet's Edges round, item 3b): an address naming the board, or the
// list under the pointer. Pasted on the gauntlet whiteboard (same site) it
// becomes that LIVE board or list there; pasted anywhere else it is just a
// link to Boardkit. Pure, tested in widgetRef.test.ts.

export interface WidgetRef {
  readonly board: string;
  /** One list of the board, else the whole board. */
  readonly list?: string;
}

/** `https://<site>/boardkit/?board=<id>&list=<id>`. */
export function widgetRefUrl(origin: string, ref: WidgetRef): string {
  const q = new URLSearchParams({ board: ref.board });
  if (ref.list) q.set("list", ref.list);
  return `${origin}/boardkit/?${q.toString()}`;
}

/** The board (and list) a copied address names, if it is one. */
export function readWidgetRef(text: string): WidgetRef | null {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return null;
  }
  if (!/^\/boardkit\/?$/.test(url.pathname)) return null;
  const board = url.searchParams.get("board");
  if (!board) return null;
  const list = url.searchParams.get("list") ?? undefined;
  return list ? { board, list } : { board };
}
