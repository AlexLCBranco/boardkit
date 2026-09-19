import { useEffect } from "react";

import {
  useClearSelection,
  useCopySelection,
  usePasteInto,
  useSelectedCount,
} from "../../store/selectors";
import type { ListId } from "../../domain/types";

/**
 * Ctrl/Cmd+C copies the selected cards, Ctrl/Cmd+V pastes them into the list
 * under the pointer, Escape clears the selection.
 *
 * "Under the pointer" because a paste needs a destination and the board has
 * no focused-list notion yet; the last known pointer position stands in for
 * one. Every shortcut stands aside while a text field has focus, and copy
 * also stands aside when the user has highlighted text -- that Ctrl+C is
 * theirs. (Same reasoning as `useUndoRedoShortcuts`; the keyboard-shortcuts
 * plan will fold both into one registry.)
 */
export function useSelectionShortcuts(): void {
  const selectedCount = useSelectedCount();
  const clearSelection = useClearSelection();
  const copySelection = useCopySelection();
  const pasteInto = usePasteInto();

  useEffect(() => {
    let pointer = { x: 0, y: 0 };

    function handlePointerMove(event: PointerEvent) {
      pointer = { x: event.clientX, y: event.clientY };
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) {
        return;
      }
      if (event.key === "Escape" && selectedCount > 0) {
        clearSelection();
        return;
      }
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }
      const key = event.key.toLowerCase();

      if (key === "c" && selectedCount > 0 && !window.getSelection()?.toString()) {
        event.preventDefault();
        copySelection();
      } else if (key === "v") {
        const column = document.elementFromPoint(pointer.x, pointer.y)?.closest<HTMLElement>("[data-list-id]");
        if (column) {
          event.preventDefault();
          pasteInto(column.dataset.listId as ListId);
        }
      }
    }

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedCount, clearSelection, copySelection, pasteInto]);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable;
}
