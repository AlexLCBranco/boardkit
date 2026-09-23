import { useEffect, useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { NORMAL_EMPHASIS, NUMBER_EMPHASIS_LABELS, type NumberEmphasisChoice } from "../../domain/numberStyle";
import {
  readSelectedCardIds,
  useClearSelection,
  useClipboard,
  useCopySelection,
  useSelectedCount,
  useSetCardsNumberEmphasis,
} from "../../store/selectors";
import styles from "./SelectionBar.module.css";

/** How long "Copied" stays on the button before it offers "Copy" again. */
const COPIED_FLASH_MS = 1500;

/**
 * The floating bar that appears once the marquee has selected something:
 * how many cards, a Copy button, and a way to let go. Mounted only while
 * there is a selection, so it costs nothing the rest of the time.
 *
 * "Copied" is keyed off the clipboard changing rather than off this button's
 * own click, so Ctrl+C gives the same confirmation.
 *
 * "Number" sets one emphasis on every selected card at once (one undo
 * step). Unnumbered cards in the selection take it too, harmlessly: it only
 * shows once they're numbered, and that's what a single card does as well.
 */
export function SelectionBar() {
  const selectedCount = useSelectedCount();
  const clipboard = useClipboard();
  const copySelection = useCopySelection();
  const clearSelection = useClearSelection();
  const setCardsNumberEmphasis = useSetCardsNumberEmphasis();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (clipboard.length === 0) {
      return;
    }
    setCopied(true);
    const timer = setTimeout(() => setCopied(false), COPIED_FLASH_MS);
    return () => clearTimeout(timer);
  }, [clipboard]);

  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className={styles.bar} role="toolbar" aria-label="Selection">
      <span className={styles.count}>{selectedCount} selected</span>
      <button type="button" className={styles.button} onClick={copySelection}>
        {copied ? "Copied ✓" : "Copy"}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={styles.button}>
            Number ▾
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top">
          {(Object.keys(NUMBER_EMPHASIS_LABELS) as NumberEmphasisChoice[]).map((choice) => (
            <DropdownMenuItem
              key={choice}
              // Read at click time, not subscribed: the bar would otherwise
              // re-render on every card the marquee sweeps over.
              onSelect={() =>
                setCardsNumberEmphasis(
                  readSelectedCardIds(),
                  choice === NORMAL_EMPHASIS ? undefined : choice,
                )
              }
            >
              {NUMBER_EMPHASIS_LABELS[choice]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <button
        type="button"
        className={styles.button}
        onClick={clearSelection}
        aria-label="Clear selection"
      >
        ×
      </button>
    </div>
  );
}
