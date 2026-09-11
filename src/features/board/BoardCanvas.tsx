import { useListOrder } from "../../store/selectors";
import styles from "./BoardCanvas.module.css";
import { ListColumn } from "./ListColumn";

/**
 * The board canvas: a horizontally scrolling rail that lists are laid out in.
 *
 * It subscribes to `listOrder` alone -- an array of ids. Nothing that happens
 * inside a column can change that array, so the canvas re-renders only when
 * lists are added, removed or reordered, never when a card changes.
 *
 * The scroll container is deliberately this element, and it is marked with
 * `data-board-canvas` so drag auto-scrolling can find it later without a ref
 * being threaded through the tree.
 */
export function BoardCanvas() {
  const listOrder = useListOrder();

  return (
    <div className={styles.canvas} data-board-canvas>
      <div className={styles.rail}>
        {listOrder.length === 0 ? (
          <p className={styles.placeholder}>No lists yet.</p>
        ) : (
          listOrder.map((listId) => <ListColumn key={listId} listId={listId} />)
        )}
      </div>
    </div>
  );
}
