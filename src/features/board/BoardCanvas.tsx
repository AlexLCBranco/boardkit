import { Composer } from "../../components/Composer";
import { useAddList, useListOrder } from "../../store/selectors";
import styles from "./BoardCanvas.module.css";
import { ListColumn } from "./ListColumn";

/**
 * The board canvas: a horizontally scrolling rail that lists are laid out in.
 *
 * It subscribes to `listOrder` alone -- an array of ids -- plus the stable
 * `addList` action. Nothing that happens inside a column can change that
 * array, so the canvas re-renders only when lists are added, removed or
 * reordered, never when a card changes.
 *
 * The scroll container is deliberately this element, and it is marked with
 * `data-board-canvas` so drag auto-scrolling can find it later without a ref
 * being threaded through the tree.
 */
export function BoardCanvas() {
  const listOrder = useListOrder();
  const addList = useAddList();

  return (
    <div className={styles.canvas} data-board-canvas>
      <div className={styles.rail}>
        {listOrder.map((listId) => (
          <ListColumn key={listId} listId={listId} />
        ))}
        <div className={styles.addListSlot}>
          <Composer label="Add a list" placeholder="Enter list title…" onSubmit={addList} />
        </div>
      </div>
    </div>
  );
}
