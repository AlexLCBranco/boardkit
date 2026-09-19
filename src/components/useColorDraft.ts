import { useEffect, useRef, useState } from "react";

import type { HexColor, ItemColor } from "../domain/types";
import { useRememberColor } from "../store/selectors";

/**
 * The "one drag, one write" rule for the custom colour picker, shared by
 * everything that hosts it (a card's or list's customise panel, the board
 * background panel).
 *
 * The picker's colour while it is being dragged or typed into is a *draft*:
 * shown live through `onPreview` but not saved, because a drag fires dozens
 * of changes and saving each would bury the undo stack and the disk. The
 * whole session becomes one `onSave`, when the host closes (`finish`) or a
 * swatch or typed hex is confirmed (`commit`). Escape abandons the draft.
 * A ref mirrors it so `finish` reads the latest value, not the one from the
 * render it was created in.
 */
export function useColorDraft(
  onSave: (color: ItemColor | undefined) => void,
  onPreview: (color: ItemColor | null) => void,
) {
  const rememberColor = useRememberColor();
  const [draft, setDraft] = useState<HexColor | null>(null);
  const draftRef = useRef<HexColor | null>(null);
  const isDiscardedRef = useRef(false);

  function updateDraft(next: HexColor | null) {
    draftRef.current = next;
    setDraft(next);
    onPreview(next);
  }

  /** Saves `color` now, and remembers it if it is a custom one. */
  function commit(color: ItemColor | undefined) {
    updateDraft(null);
    onSave(color);
    if (color !== undefined && color.startsWith("#")) {
      rememberColor(color as HexColor);
    }
  }

  // Escape has to be seen *before* the host's own Escape handler closes it
  // (which would otherwise save the draft), so this listens in the capture
  // phase, which runs ahead of a bubbling handler.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        isDiscardedRef.current = true;
      }
    }
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  /** The host is closing: save what is pending, unless Escape discarded it. */
  function finish() {
    const pending = draftRef.current;
    if (pending !== null && !isDiscardedRef.current) {
      commit(pending);
    } else {
      updateDraft(null);
    }
  }

  return { draft, updateDraft, commit, finish };
}
