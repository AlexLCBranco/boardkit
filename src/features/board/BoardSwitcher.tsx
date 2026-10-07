import { useMemo, useRef, useState, type ChangeEvent } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { InlineEditable } from "../../components/InlineEditable";
import {
  useActiveBoardName,
  useBoardId,
  useBoards,
  useCreateBoard,
  useCreateBoardFromLayout,
  useDeleteBoard,
  useDuplicateBoard,
  useRenameBoard,
  useSwitchBoard,
} from "../../store/selectors";
import { findLinkedMap, type LinkedMap } from "../../store/linkedMap";
import { BackgroundPanel } from "./BackgroundPanel";
import { exportBackup, importBackup } from "./backup";
import { AutomaticBackupItems, BackupStatusLine, useBackupAttention } from "./BackupMenuItems";
import styles from "./BoardSwitcher.module.css";
import { NewBoardDialog } from "./NewBoardDialog";

/**
 * The board's name (click to rename, same `InlineEditable` every other title
 * in the app uses) plus a menu to switch to another saved board or create a
 * new one.
 *
 * The menu itself is the one place in the app that reaches for shadcn/ui
 * rather than a hand-rolled `Popover` -- it's supporting chrome, not part of
 * the board engine's drag surface, which is exactly the split CLAUDE.md
 * draws between the two. Its colours still come from `tokens.css`, via the
 * `@theme inline` bridge in `global.css`, not a second palette.
 */
export function BoardSwitcher() {
  const boardId = useBoardId();
  const boards = useBoards();
  const name = useActiveBoardName();
  const renameBoard = useRenameBoard();
  const switchBoard = useSwitchBoard();
  const createBoard = useCreateBoard();
  const createBoardFromLayout = useCreateBoardFromLayout();
  const duplicateBoard = useDuplicateBoard();
  const deleteBoard = useDeleteBoard();
  const backupNeedsAttention = useBackupAttention();
  const fileInput = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [choosingBackground, setChoosingBackground] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Looked up as the question opens, so it names the map as Linkkit has it now.
  const [linkedMap, setLinkedMap] = useState<LinkedMap | null>(null);
  const [namingNewBoard, setNamingNewBoard] = useState(false);
  const [namingLayoutBoard, setNamingLayoutBoard] = useState(false);
  // Stored oldest-first (creation order); listed newest-first, so this
  // week's board is always at the top however many have piled up.
  const newestFirst = useMemo(() => [...boards].reverse(), [boards]);

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    // Cleared so choosing the same file again still fires `change`.
    input.value = "";
    if (!file) return;
    try {
      const { added, skipped } = await importBackup(file);
      const parts = [`Imported ${added} board${added === 1 ? "" : "s"}.`];
      if (skipped > 0) parts.push(`${skipped} already existed and were left untouched.`);
      window.alert(parts.join(" "));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Import failed.");
    }
  }

  return (
    <div className={styles.switcher}>
      <InlineEditable value={name} onCommit={renameBoard} ariaLabel="Board name" className={styles.name} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            ref={triggerRef}
            type="button"
            className={styles.trigger}
            aria-label="Switch board"
            data-attention={backupNeedsAttention}
          >
            ▾
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-56">
          {newestFirst.map((board) => (
            <DropdownMenuItem key={board.id} onSelect={() => switchBoard(board.id)}>
              {board.id === boardId ? "✓ " : ""}
              {board.name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setNamingNewBoard(true)}>
            + New board
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => duplicateBoard(`${name} (copy)`)}>
            Duplicate this board
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setNamingLayoutBoard(true)}>
            New board from these lists
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setChoosingBackground(true)}>
            Background…
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={boards.length <= 1}
            onSelect={() => {
              setLinkedMap(findLinkedMap(boardId));
              setConfirmingDelete(true);
            }}
          >
            Delete this board…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <BackupStatusLine />
          <DropdownMenuItem onSelect={() => void exportBackup()}>Export all boards…</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => fileInput.current?.click()}>Import boards…</DropdownMenuItem>
          <AutomaticBackupItems />
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Keyed by board, so switching boards while it is open drops an unsaved
          preview instead of applying it to the wrong board. */}
      {choosingBackground && (
        <BackgroundPanel
          key={boardId}
          anchorRef={triggerRef}
          onClose={() => setChoosingBackground(false)}
        />
      )}
      {/* Outside the menu on purpose: the menu unmounts as soon as an item
          is chosen, and the file picker's change event needs an input that
          is still in the page when the user comes back from it. */}
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={handleImport}
      />
      <NewBoardDialog
        open={namingNewBoard}
        onOpenChange={setNamingNewBoard}
        defaultName={`Untitled board ${boards.length + 1}`}
        onCreate={createBoard}
      />
      <NewBoardDialog
        open={namingLayoutBoard}
        onOpenChange={setNamingLayoutBoard}
        defaultName={`Untitled board ${boards.length + 1}`}
        description="Keeps this board's lists, without their cards. Give the new board a name."
        onCreate={createBoardFromLayout}
      />
      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the board and everything in it, including its trash. It cannot be undone —
              export a backup first if you might want it back.
            </AlertDialogDescription>
            {linkedMap && (
              <AlertDialogDescription>
                {linkedMap.inTrash
                  ? `“${linkedMap.name}” is a map in Linkkit’s trash, linked to this board; restored there, it comes back as an ordinary tree.`
                  : `“${linkedMap.name}” is also a map in Linkkit; Linkkit keeps its copy as an ordinary tree.`}{" "}
                Boxes deleted from that map are in this board’s trash and go with it.
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={deleteBoard}>
              Delete board
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
