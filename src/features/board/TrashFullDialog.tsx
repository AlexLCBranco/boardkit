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
import { LIST_TRASH_LIMIT, TRASH_LIMIT } from "../../domain/trash";
import { useErasedDescription, useTrashWarningStore } from "../../store/trashWarningStore";

/**
 * Asks before a delete would push the oldest entry out of a full trash.
 * Mounted once (in `App`); `guardTrash` opens it from wherever the delete
 * started. Supporting chrome, so shadcn's AlertDialog like the list-delete
 * confirmation.
 */
export function TrashFullDialog() {
  const pending = useTrashWarningStore((s) => s.pending);
  const close = useTrashWarningStore((s) => s.close);
  const erased = useErasedDescription(pending?.kind ?? null);

  const kind = pending?.kind ?? "card";
  const limit = kind === "card" ? `${TRASH_LIMIT} cards` : `${LIST_TRASH_LIMIT} lists`;

  return (
    <AlertDialog open={pending !== null} onOpenChange={(open) => !open && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>The trash is full</AlertDialogTitle>
          <AlertDialogDescription>
            The trash holds {limit}. Deleting this {kind} will permanently erase {erased}. To keep
            it, cancel and restore or delete things in the trash first.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              pending?.run();
              close();
            }}
          >
            Delete and erase the oldest
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
