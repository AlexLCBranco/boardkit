import { useState } from "react";

import { SelectionMenu, type SelectionMenuItem } from "../../components/SelectionMenu";
import type { BoardState } from "../../domain/types";
import { useBoardApi } from "../../store/boardContext";
import type { BoardStore } from "../../store/boardStore";
import { useLinkPromptStore, type LinkTarget } from "../../store/linkPromptStore";
import { useActiveBoardName } from "../../store/selectors";

/**
 * Links on cards, lists and the board (owner, 2026-10-23): what they hold
 * (`url`, domain/url.ts), the menu items that add, edit and remove one,
 * and the field they are typed into. One behaviour for all three, here and
 * on the gauntlet whiteboard.
 */

/** The link `target` holds on `board`, if any. */
export function urlOf(board: BoardState, target: LinkTarget): string | undefined {
  if (target.kind === "card") return board.cards[target.cardId]?.url;
  if (target.kind === "list") return board.lists[target.listId]?.url;
  return board.url;
}

/** Sets (or, with `undefined`, removes) `target`'s link: one undo step. */
export function setUrlOf(store: BoardStore, target: LinkTarget, url: string | undefined): void {
  if (target.kind === "card") store.setCardUrl(target.cardId, url);
  else if (target.kind === "list") store.setListUrl(target.listId, url);
  else store.setBoardUrl(url);
}

/** "Add link…" (or "Edit link…", showing the link) and "Remove link", for a
    right-click menu at `at`. */
export function linkMenuItems(
  store: BoardStore,
  target: LinkTarget,
  at: { readonly x: number; readonly y: number },
): SelectionMenuItem[] {
  const url = urlOf(store, target);
  const open = () => useLinkPromptStore.getState().open(target, at);
  if (!url) return [{ label: "Add link…", onPick: open }];
  return [
    { label: "Edit link…", hint: url, onPick: open },
    { label: "Remove link", onPick: () => setUrlOf(store, target, undefined) },
  ];
}

export function headingOf(board: BoardState, target: LinkTarget): string {
  if (target.kind === "card") return `Link for card ${quote(board.cards[target.cardId]?.title ?? "")}`;
  if (target.kind === "list") return `Link for list ${quote(board.lists[target.listId]?.title ?? "")}`;
  return "Link for this board";
}

export const quote = (title: string) => {
  const line = title.trim().replace(/\s+/g, " ");
  return `“${line.length > 32 ? `${line.slice(0, 31).trimEnd()}…` : line}”`;
};

/**
 * The board's own right-click menu (its link), for the board's name and its
 * empty space: `onContextMenu` to put there, and `menu` to draw. A
 * right-click on a list, a card or a text field is theirs, not the board's.
 */
export function useBoardLinkMenu(): {
  readonly onContextMenu: (event: React.MouseEvent) => void;
  readonly menu: React.ReactNode;
} {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const api = useBoardApi();
  const name = useActiveBoardName();
  const onContextMenu = (event: React.MouseEvent) => {
    const el = event.target as HTMLElement;
    if (el.closest("[data-list-id], [data-card-id], textarea, input, [role='menu'], [data-link-prompt]")) return;
    event.preventDefault();
    setAt({ x: event.clientX, y: event.clientY });
  };
  const menu = at && (
    <SelectionMenu
      x={at.x}
      y={at.y}
      heading={`Board ${quote(name)}`}
      items={linkMenuItems(api.getState(), { kind: "board" }, at).map((item) => ({
        ...item,
        onPick: () => {
          setAt(null);
          item.onPick();
        },
      }))}
      onDismiss={() => setAt(null)}
    />
  );
  return { onContextMenu, menu };
}
