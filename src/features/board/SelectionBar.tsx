import { useEffect, useState } from "react";

import {
  useClearSelection,
  useClipboard,
  useCopySelection,
  useSelectedCount,
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
 */
export function SelectionBar() {
  const selectedCount = useSelectedCount();
  const clipboard = useClipboard();
  const copySelection = useCopySelection();
  const clearSelection = useClearSelection();
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
