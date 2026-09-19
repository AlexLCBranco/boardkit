import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { useRef, useState } from "react";

import { Composer } from "../../components/Composer";
import { useAddList, useListOrder } from "../../store/selectors";
import { SearchDialog } from "../search/SearchDialog";
import { ShortcutsDialog } from "../shortcuts/ShortcutsDialog";
import { useShortcuts } from "../shortcuts/useShortcuts";
import { BoardBackdrop } from "./BoardBackdrop";
import styles from "./BoardCanvas.module.css";
import { CopyBoardButton } from "./CopyBoardButton";
import { BoardDragContext } from "./DragContext";
import { ListColumn } from "./ListColumn";
import { SaveBoardButton } from "./SaveBoardButton";
import { SelectionBar } from "./SelectionBar";
import { UndoRedoControls } from "./UndoRedoControls";
import { useBackgroundChrome } from "./useBoardBackdrop";
import { useMarqueeSelection } from "./useMarqueeSelection";
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
  const [zoom, setZoom] = useState(1);
  const railRef = useRef<HTMLDivElement>(null);
  const marqueeRef = useRef<HTMLDivElement>(null);
  const handleCanvasPointerDown = useMarqueeSelection(marqueeRef);
  useShortcuts();

  return (
    <div className={styles.canvas}>
      <BoardBackdrop />
      <BoardToolbar zoom={zoom} onZoomChange={setZoom} railRef={railRef} />
      <div className={styles.scrollArea} data-board-canvas onPointerDown={handleCanvasPointerDown}>
        <BoardDragContext>
          <div ref={railRef} className={styles.rail} style={{ zoom }}>
            <SortableContext items={[...listOrder]} strategy={horizontalListSortingStrategy}>
              {listOrder.map((listId) => (
                <ListColumn key={listId} listId={listId} />
              ))}
            </SortableContext>
            <AddListSlot />
          </div>
        </BoardDragContext>
      </div>
      <div ref={marqueeRef} className={styles.marquee} aria-hidden="true" />
      <SelectionBar />
    </div>
  );
}

/**
 * The toolbar as its own component so it can read the background's scheme
 * without the canvas (and so every list) re-rendering when the background
 * changes. `data-scheme` and `data-ink` (tokens.css) restyle its controls to
 * read on the background; with no background it is left alone and follows
 * the theme.
 */
function BoardToolbar({
  zoom,
  onZoomChange,
  railRef,
}: {
  readonly zoom: number;
  readonly onZoomChange: (zoom: number) => void;
  readonly railRef: React.RefObject<HTMLElement | null>;
}) {
  const chrome = useBackgroundChrome();
  return (
    <div className={styles.toolbar} data-scheme={chrome?.scheme} data-ink={chrome?.ink}>
      <UndoRedoControls />
      <ZoomControls zoom={zoom} onZoomChange={onZoomChange} />
      <SearchDialog />
      <ShortcutsDialog />
      <CopyBoardButton railRef={railRef} />
      <SaveBoardButton railRef={railRef} />
    </div>
  );
}

/** "Add a list", on the same terms as the toolbar: it has no surface of its
    own, so it follows the background's scheme. */
function AddListSlot() {
  const addList = useAddList();
  const chrome = useBackgroundChrome();
  return (
    <div
      className={styles.addListSlot}
      data-scheme={chrome?.scheme}
      data-ink={chrome?.ink}
      data-capture-exclude="true"
    >
      <Composer label="Add a list" placeholder="Enter list title…" onSubmit={addList} />
    </div>
  );
}
