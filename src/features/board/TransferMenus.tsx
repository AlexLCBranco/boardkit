import { useMemo, type ReactNode, type SyntheticEvent } from "react";
import { toast } from "sonner";

import {
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "../../components/ui/context-menu";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "../../components/ui/dropdown-menu";
import type { BoardSummary, CardId, ListId } from "../../domain/types";
import type { TransferMode } from "../../store/boardStore";
import {
  useBoardId,
  useBoards,
  useSendCardToBoard,
  useSendListToBoard,
} from "../../store/selectors";
import { loadTransferTargets } from "../../store/transferToBoard";

/**
 * The "Move to board ›" / "Copy to board ›" menus for a card (a dropdown from
 * its hover row) and for a list (its header's right-click menu).
 *
 * Supporting chrome, so shadcn menus + Tailwind rather than board-engine CSS
 * Modules. The two variants differ only in which Radix primitive they sit in
 * (a context menu vs a dropdown), so the pieces that are not the primitive --
 * which boards are offered, what the list submenu reads, the toast -- are
 * shared below.
 */

const MODES: readonly { readonly mode: TransferMode; readonly label: string }[] = [
  { mode: "move", label: "Move to board" },
  { mode: "copy", label: "Copy to board" },
];

/** Every board except the one being viewed: moving within a board is what
    drag-and-drop is for. */
function useOtherBoards(): readonly BoardSummary[] {
  const boards = useBoards();
  const activeId = useBoardId();
  return useMemo(() => boards.filter((board) => board.id !== activeId), [boards, activeId]);
}

function report(mode: TransferMode, ok: boolean, where: string, error?: string): void {
  if (ok) toast.success(`${mode === "move" ? "Moved" : "Copied"} to ${where}`);
  else toast.error(error ?? "Could not transfer.");
}

/**
 * The menu is portalled, but React events still bubble through the portal to
 * the card's `<article>`, which carries dnd-kit's key listeners (Enter/Space
 * starts a keyboard drag) and the right-click-toggles-thots handler. Stop the
 * ones a menu uses so it cannot trigger either.
 */
export const stopBubbling = {
  onKeyDown: (event: SyntheticEvent) => event.stopPropagation(),
  onPointerDown: (event: SyntheticEvent) => event.stopPropagation(),
  onContextMenu: (event: SyntheticEvent) => event.stopPropagation(),
};

const NO_OTHER_BOARD = "Make another board first";

// -- Card ------------------------------------------------------------------

/** The body of the card's dropdown. Mounted only while the menu is open, so
    the boards subscription costs nothing on a closed card. */
export function CardTransferContent({ cardId, listId }: { cardId: CardId; listId: ListId }) {
  const others = useOtherBoards();

  return (
    <DropdownMenuContent align="end" className="min-w-44 whitespace-nowrap" {...stopBubbling}>
      {others.length === 0 ? (
        <DropdownMenuItem disabled>{NO_OTHER_BOARD}</DropdownMenuItem>
      ) : (
        MODES.map(({ mode, label }) => (
          <DropdownMenuSub key={mode}>
            <DropdownMenuSubTrigger>{label}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-40 whitespace-nowrap">
              {others.map((board) => (
                <DropdownMenuSub key={board.id}>
                  <DropdownMenuSubTrigger>{board.name}</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="min-w-40 whitespace-nowrap">
                    <CardListPicker
                      mode={mode}
                      board={board}
                      cardId={cardId}
                      listId={listId}
                    />
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))
      )}
    </DropdownMenuContent>
  );
}

/** The lists on one board. Mounted when its submenu opens, which is when the
    board is read -- so the names are current, and nothing is kept in state. */
function CardListPicker({
  mode,
  board,
  cardId,
  listId,
}: {
  mode: TransferMode;
  board: BoardSummary;
  cardId: CardId;
  listId: ListId;
}) {
  const sendCardToBoard = useSendCardToBoard();
  const targets = useMemo(() => loadTransferTargets(board.id), [board.id]);

  if (!targets) return <DropdownMenuItem disabled>Couldn't read this board</DropdownMenuItem>;
  if (targets.length === 0) return <DropdownMenuItem disabled>No lists on this board</DropdownMenuItem>;

  return (
    <>
      {targets.map((target) => (
        <DropdownMenuItem
          key={target.id}
          disabled={target.full}
          onSelect={() => {
            const result = sendCardToBoard(mode, listId, cardId, board.id, target.id);
            report(mode, result.ok, `“${board.name}” → “${target.title || "Untitled list"}”`, !result.ok ? result.message : undefined);
          }}
        >
          {target.title || "Untitled list"}
          {target.full && " (full)"}
        </DropdownMenuItem>
      ))}
    </>
  );
}

// -- List ------------------------------------------------------------------

/** The list header's context-menu items: "Move to board ›" and
    "Copy to board ›", each opening a board picker. */
export function ListTransferItems({ listId }: { listId: ListId }): ReactNode {
  const others = useOtherBoards();
  const sendListToBoard = useSendListToBoard();

  if (others.length === 0) {
    return (
      <>
        {MODES.map(({ mode, label }) => (
          <ContextMenuItem key={mode} disabled title={NO_OTHER_BOARD}>
            {label} — {NO_OTHER_BOARD.toLowerCase()}
          </ContextMenuItem>
        ))}
      </>
    );
  }

  return (
    <>
      {MODES.map(({ mode, label }) => (
        <ContextMenuSub key={mode}>
          <ContextMenuSubTrigger>{label}</ContextMenuSubTrigger>
          <ContextMenuSubContent className="whitespace-nowrap">
            {others.map((board) => (
              <ContextMenuItem
                key={board.id}
                onSelect={() => {
                  const result = sendListToBoard(mode, listId, board.id);
                  report(mode, result.ok, `“${board.name}”`, !result.ok ? result.message : undefined);
                }}
              >
                {board.name}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
      ))}
    </>
  );
}
