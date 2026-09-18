import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { useRef, useState } from "react";

import { Composer } from "../../components/Composer";
import { useAddList, useListOrder } from "../../store/selectors";
import styles from "./BoardCanvas.module.css";
import { CopyBoardButton } from "./CopyBoardButton";
import { BoardDragContext } from "./DragContext";
import { ListColumn } from "./ListColumn";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { UndoRedoControls } from "./UndoRedoControls";
import { useUndoRedoShortcuts } from "./useUndoRedoShortcuts";
import { ZoomControls } from "./ZoomControls";

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
 * that container, in its own fixed-height row, so it never scrolls out of
 * view with the lists.
 */
export function BoardCanvas() {
  const listOrder = useListOrder();
  const addList = useAddList();
  const [zoom, setZoom] = useState(1);
  const railRef = useRef<HTMLDivElement>(null);
  useUndoRedoShortcuts();

  return (
    <div className={styles.canvas}>
      <div className={styles.toolbar}>
        <UndoRedoControls />
        <ZoomControls zoom={zoom} onZoomChange={setZoom} />
        <ShortcutsDialog />
        <CopyBoardButton railRef={railRef} />
      </div>
      <div className={styles.scrollArea} data-board-canvas>
        <BoardDragContext>
          <div ref={railRef} className={styles.rail} style={{ zoom }}>
            <SortableContext items={[...listOrder]} strategy={horizontalListSortingStrategy}>
              {listOrder.map((listId) => (
                <ListColumn key={listId} listId={listId} />
              ))}
            </SortableContext>
            <div className={styles.addListSlot} data-capture-exclude="true">
              <Composer label="Add a list" placeholder="Enter list title…" onSubmit={addList} />
            </div>
          </div>
        </BoardDragContext>
      </div>
    </div>
  );
}
