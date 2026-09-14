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
import type { TrashEntry } from "../../domain/types";
import {
  useCard,
  useEmptyTrash,
  useList,
  usePermanentlyDeleteCard,
  useRestoreCard,
  useTrash,
  useTrashCount,
} from "../../store/selectors";

/**
 * Where a deleted card goes instead of vanishing. Deliberately low-key --
 * a small icon button, easy to miss until you go looking for it -- since
 * this is a safety net for mis-clicks, not a feature to surface.
 *
 * Supporting chrome (a dialog listing cards, not the board itself), so it's
 * Tailwind + shadcn/ui like the rest of the app's chrome, per CLAUDE.md --
 * the board engine's CSS-Modules-only rule doesn't apply here.
 */
export function TrashPanel() {
  const trash = useTrash();
  const count = useTrashCount();
  const emptyTrash = useEmptyTrash();

  // Most recently deleted first.
  const entries = [...trash].reverse();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Recently deleted cards"
          className="relative ml-auto inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground/60 transition-colors hover:bg-muted hover:text-muted-foreground"
        >
          <Trash2 size={15} />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-muted px-0.5 text-[9px] font-medium text-muted-foreground">
              {count}
            </span>
          )}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Recently deleted</DialogTitle>
          <DialogDescription>
            Deleted cards sit here until you restore them or delete them for good.
          </DialogDescription>
        </DialogHeader>

        {entries.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">Nothing here.</p>
        ) : (
          <>
            <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
              {entries.map((entry) => (
                <TrashRow key={entry.cardId} entry={entry} />
              ))}
            </ul>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={emptyTrash}>
                Empty trash
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TrashRow({ entry }: { entry: TrashEntry }) {
  const card = useCard(entry.cardId);
  const list = useList(entry.listId);
  const restoreCard = useRestoreCard();
  const permanentlyDeleteCard = usePermanentlyDeleteCard();

  return (
    <li className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{card.title || "Untitled card"}</p>
        <p className="truncate text-xs text-muted-foreground">
          {list ? `from "${list.title}"` : "original list was deleted"} ·{" "}
          {formatDistanceToNow(entry.deletedAt, { addSuffix: true })}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => restoreCard(entry.cardId)}
        disabled={!list}
        aria-label="Restore card"
        title={list ? "Restore" : "Original list was deleted"}
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
