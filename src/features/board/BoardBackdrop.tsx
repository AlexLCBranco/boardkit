import type { CSSProperties } from "react";

import { backgroundCss } from "../../domain/background";
import styles from "./BoardCanvas.module.css";
import { useShownBackground } from "./useBackgroundScheme";

/**
 * The layer behind the lists that carries the board's background.
 *
 * Its own component, subscribed to the background alone, so that dragging the
 * colour picker (which previews at pointer speed) repaints this one element
 * and never re-renders the lists. The colour is a custom property, not an
 * inline `background`, so the stylesheet stays the one place that decides how
 * it is painted.
 */
export function BoardBackdrop() {
  const background = useShownBackground();
  const style =
    background === undefined
      ? undefined
      : ({ "--board-background": backgroundCss(background) } as CSSProperties);
  return <div className={styles.backdrop} style={style} aria-hidden="true" />;
}
