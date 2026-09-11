import styles from "./BoardCanvas.module.css";

/**
 * The board canvas: a horizontally scrolling rail that lists are laid out in.
 *
 * Milestone 1 renders the empty surface only. It exists now so that the
 * scroll container, its padding and its overflow behaviour are settled before
 * any drag logic is built on top of them -- drag-and-drop maths depends on the
 * scroll container being a known, stable element.
 */
export function BoardCanvas() {
  return (
    <div className={styles.canvas} data-board-canvas>
      <div className={styles.rail}>
        <p className={styles.placeholder}>No lists yet.</p>
      </div>
    </div>
  );
}
