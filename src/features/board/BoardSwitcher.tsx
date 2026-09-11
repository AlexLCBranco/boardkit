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
  useRenameBoard,
  useSwitchBoard,
} from "../../store/selectors";
import styles from "./BoardSwitcher.module.css";

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

  return (
    <div className={styles.switcher}>
      <InlineEditable value={name} onCommit={renameBoard} ariaLabel="Board name" className={styles.name} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={styles.trigger} aria-label="Switch board">
            ▾
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {boards.map((board) => (
            <DropdownMenuItem key={board.id} onSelect={() => switchBoard(board.id)}>
              {board.id === boardId ? "✓ " : ""}
              {board.name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => createBoard(`Untitled board ${boards.length + 1}`)}>
            + New board
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
