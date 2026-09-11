import { useEffect } from "react";

import { useCanRedo, useCanUndo, useRedo, useUndo } from "../../store/selectors";

/**
 * Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z for the board's own undo/redo.
 *
 * Skipped while an editable field has focus -- a card or list title being
 * typed into `InlineEditable` -- so the browser's native text-field undo
 * keeps working on the draft instead of this hook stealing the keystroke and
 * undoing the board's last committed move instead.
 */
export function useUndoRedoShortcuts(): void {
  const undo = useUndo();
  const redo = useRedo();
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") {
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }

      event.preventDefault();
      if (event.shiftKey) {
        if (canRedo) {
          redo();
        }
      } else if (canUndo) {
        undo();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, canUndo, canRedo]);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable;
}
