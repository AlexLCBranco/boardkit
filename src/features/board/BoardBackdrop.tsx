import type { CSSProperties } from "react";

import { backgroundCss } from "../../domain/background";
import styles from "./BoardCanvas.module.css";
import { useBackdrop } from "./useBoardBackdrop";

/**
 * The layer behind the lists that carries the board's background.
 *
 * Its own component, subscribed to the background alone, so that dragging the
 * colour picker or the dimming slider (which preview at pointer speed)
 * repaints this one element and never re-renders the lists. The colour and the
 * dimming are custom properties or a bare opacity, so the stylesheet stays the
 * one place that decides how they are painted.
 *
 * An image is two static layers -- the picture, and the theme's page colour at
 * `wash` opacity over it -- inside a canvas that never scrolls (only the lists
 * scroll, above it), so scrolling and dragging paint nothing extra here.
 * Nothing animates; the wash only ever changes `opacity`.
 */
export function BoardBackdrop() {
  const backdrop = useBackdrop();
  if (backdrop === undefined) {
    return <div className={styles.backdrop} aria-hidden="true" />;
  }
  const { background, imageUrl } = backdrop;

  if (background.kind === "color") {
    const style = { "--board-background": backgroundCss(background) } as CSSProperties;
    return <div className={styles.backdrop} style={style} aria-hidden="true" />;
  }

  return (
    <div className={styles.backdrop} aria-hidden="true">
      {imageUrl !== undefined && (
        <>
          <div className={styles.image} style={{ "--board-image": `url("${imageUrl}")` } as CSSProperties} />
          <div className={styles.wash} style={{ opacity: background.wash }} />
        </>
      )}
    </div>
  );
}
