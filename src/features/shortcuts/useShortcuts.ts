import { useEffect } from "react";

import { focusTargetOf, isDragging, isEditableTarget, recordPointer } from "./dom";
import { findShortcut } from "./registry";

/**
 * The app's one `keydown` listener. It works out where focus is (a card, a
 * list header, or neither), asks the registry which shortcut that key press
 * means there, and runs it. Every shortcut goes through here, so the two
 * rules that must hold for all of them are written once:
 *
 *  - Typing is sacred: unless an entry opts in, nothing fires while a text
 *    field has focus (a card title being edited, the composer).
 *  - The drag wins: while a card or list is held with the keyboard, the arrow
 *    keys and Space are dnd-kit's, so nothing here fires.
 */
export function useShortcuts(): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Already handled by something closer to the key press (dnd-kit's
      // sensor, a menu), or an IME still composing a character.
      if (event.defaultPrevented || event.isComposing || isDragging()) {
        return;
      }
      const target = focusTargetOf(event.target);
      const shortcut = findShortcut(event, target.scope, isEditableTarget(event.target));
      if (!shortcut) {
        return;
      }
      event.preventDefault();
      shortcut.run(target);
    }

    document.addEventListener("pointermove", recordPointer);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointermove", recordPointer);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
}
