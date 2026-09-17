import styles from "./ZoomControls.module.css";

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 2;
const ZOOM_STEP = 0.1;

export function clampZoom(zoom: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(zoom * 100) / 100));
}

export function zoomedIn(zoom: number): number {
  return clampZoom(zoom + ZOOM_STEP);
}

export function zoomedOut(zoom: number): number {
  return clampZoom(zoom - ZOOM_STEP);
}

/**
 * The board's zoom control -- a pill of [-] [percentage] [+], matching the
 * one in Excalidraw. `zoom` and `onZoomChange` are owned by `BoardCanvas`,
 * which is the component actually applying it (as CSS `zoom`, not `transform:
 * scale`, so the scroll area's overflow shrinks along with the cards), so
 * this stays a plain display for it rather than holding its own state.
 */
export function ZoomControls({
  zoom,
  onZoomChange,
}: {
  readonly zoom: number;
  readonly onZoomChange: (zoom: number) => void;
}) {
  return (
    <div className={styles.control}>
      <button
        type="button"
        className={styles.button}
        onClick={() => onZoomChange(zoomedOut(zoom))}
        disabled={zoom <= ZOOM_MIN}
        aria-label="Zoom out"
        title="Zoom out"
      >
        −
      </button>
      <button
        type="button"
        className={styles.label}
        onClick={() => onZoomChange(1)}
        title="Reset zoom to 100%"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        type="button"
        className={styles.button}
        onClick={() => onZoomChange(zoomedIn(zoom))}
        disabled={zoom >= ZOOM_MAX}
        aria-label="Zoom in"
        title="Zoom in"
      >
        +
      </button>
    </div>
  );
}
