import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";

import { Composer } from "../../components/Composer";
import { useAddList, useListOrder } from "../../store/selectors";
import styles from "./BoardCanvas.module.css";
import { BoardDragContext } from "./DragContext";
import { ListColumn } from "./ListColumn";
import { NumberingControl } from "./NumberingControl";

/**
 * The board canvas: a horizontally scrolling rail that lists are laid out in.
 *
 * It subscribes to `listOrder` alone -- an array of ids -- plus the stable
 * `addList` action. Nothing that happens inside a column can change that
 * array, so the canvas re-renders only when lists are added, removed or
 * reordered, never when a card changes.
 *
 * The scroll container is deliberately the rail below the toolbar, and it is
 * marked with `data-board-canvas` so drag auto-scrolling can find it later
 * without a ref being threaded through the tree. The toolbar sits outside
 * that container, in its own fixed-height row, so board-level settings
 * (numbering) never scroll out of view with the lists.
 */
export function BoardCanvas() {
  const listOrder = useListOrder();
  const addList = useAddList();

  return (
    <div className={styles.canvas}>
      <div className={styles.toolbar}>
        <NumberingControl />
      </div>
      <div className={styles.scrollArea} data-board-canvas>
        <BoardDragContext>
          <div className={styles.rail}>
            <SortableContext items={[...listOrder]} strategy={horizontalListSortingStrategy}>
              {listOrder.map((listId) => (
                <ListColumn key={listId} listId={listId} />
              ))}
            </SortableContext>
            <div className={styles.addListSlot}>
              <Composer label="Add a list" placeholder="Enter list title…" onSubmit={addList} />
            </div>
          </div>
        </BoardDragContext>
      </div>
    </div>
  );
}
