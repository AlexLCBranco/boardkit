import { formatDistanceToNow } from "date-fns";
import { RotateCcw, Trash2 } from "lucide-react";

import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import { MAX_CARDS_PER_LIST } from "../../domain/limits";
import type { TrashEntry, TrashedListEntry } from "../../domain/types";
import {
  useCard,
  useCardCount,
  useEmptyListTrash,
  useEmptyTrash,
  useIsListFull,
  useList,
  useListIsOnBoard,
  usePermanentlyDeleteCard,
  usePermanentlyDeleteList,
  useRestoreCard,
  useRestoreList,
  useTrash,
  useTrashCount,
  useTrashedLists,
  useTrashedListsCount,
} from "../../store/selectors";

/**
 * Where a deleted list or card goes instead of vanishing. Deliberately
 * low-key -- a small icon button, easy to miss until you go looking for it
 * -- since this is a safety net for mis-clicks, not a feature to surface.
 *
 * Supporting chrome (a dialog listing entries, not the board itself), so
 * it's Tailwind + shadcn/ui like the rest of the app's chrome, per
 * CLAUDE.md -- the board engine's CSS-Modules-only rule doesn't apply here.
 */
export function TrashPanel() {
  const trash = useTrash();
  const trashedLists = useTrashedLists();
  const cardCount = useTrashCount();
  const listCount = useTrashedListsCount();
  const emptyTrash = useEmptyTrash();
  const emptyListTrash = useEmptyListTrash();

  // Most recently deleted first, in both sections.
  const cardEntries = [...trash].reverse();
  const listEntries = [...trashedLists].reverse();
  const totalCount = cardCount + listCount;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Recently deleted lists and cards"
          className="relative ml-auto inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground/60 transition-colors hover:bg-muted hover:text-muted-foreground"
        >
          <Trash2 size={15} />
          {totalCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-muted px-0.5 text-[9px] font-medium text-muted-foreground">
              {totalCount}
            </span>
          )}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Recently deleted</DialogTitle>
          <DialogDescription>
            Deleted lists and cards sit here until you restore them or delete them for good.
          </DialogDescription>
        </DialogHeader>

        {totalCount === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">Nothing here.</p>
        ) : (
          <>
            <div className="flex max-h-72 flex-col gap-3 overflow-y-auto">
              {listEntries.length > 0 && (
                <div>
                  <p className="px-2 text-xs font-medium text-muted-foreground">Lists</p>
                  <ul className="flex flex-col gap-1">
                    {listEntries.map((entry) => (
                      <TrashedListRow key={entry.listId} entry={entry} />
                    ))}
                  </ul>
                </div>
              )}
              {cardEntries.length > 0 && (
                <div>
                  <p className="px-2 text-xs font-medium text-muted-foreground">Cards</p>
                  <ul className="flex flex-col gap-1">
                    {cardEntries.map((entry) => (
                      <TrashRow key={entry.cardId} entry={entry} />
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  emptyTrash();
                  emptyListTrash();
                }}
              >
                Empty trash
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TrashedListRow({ entry }: { entry: TrashedListEntry }) {
  const list = useList(entry.listId);
  const cardCount = useCardCount(entry.listId);
  const restoreList = useRestoreList();
  const permanentlyDeleteList = usePermanentlyDeleteList();

  return (
    <li className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{list.title || "Untitled list"}</p>
        <p className="truncate text-xs text-muted-foreground">
          {cardCount} card{cardCount === 1 ? "" : "s"} ·{" "}
          {formatDistanceToNow(entry.deletedAt, { addSuffix: true })}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => restoreList(entry.listId)}
        aria-label="Restore list"
        title="Restore"
      >
        <RotateCcw />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => permanentlyDeleteList(entry.listId)}
        aria-label="Delete list forever"
        title="Delete forever"
      >
        <Trash2 />
      </Button>
    </li>
  );
}

function TrashRow({ entry }: { entry: TrashEntry }) {
  const card = useCard(entry.cardId);
  const listIsOnBoard = useListIsOnBoard(entry.listId);
  const list = useList(entry.listId);
  const listIsFull = useIsListFull(entry.listId);
  const restoreCard = useRestoreCard();
  const permanentlyDeleteCard = usePermanentlyDeleteCard();

  return (
    <li className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{card.title || "Untitled card"}</p>
        <p className="truncate text-xs text-muted-foreground">
          {listIsOnBoard ? `from "${list.title}"` : "original list isn't on the board"} ·{" "}
          {formatDistanceToNow(entry.deletedAt, { addSuffix: true })}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => restoreCard(entry.cardId)}
        disabled={!listIsOnBoard || listIsFull}
        aria-label="Restore card"
        title={
          !listIsOnBoard
            ? "Original list isn't on the board"
            : listIsFull
              ? `"${list.title}" is full (${MAX_CARDS_PER_LIST} cards max)`
              : "Restore"
        }
      >
        <RotateCcw />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => permanentlyDeleteCard(entry.cardId)}
        aria-label="Delete forever"
        title="Delete forever"
      >
        <Trash2 />
      </Button>
    </li>
  );
}
