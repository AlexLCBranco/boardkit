import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { memo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

import { Composer } from "../../components/Composer";
import { CustomizePanel } from "../../components/CustomizePanel";
import { Icon } from "../../components/Icon";
import { InlineEditable } from "../../components/InlineEditable";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import type { ListId } from "../../domain/types";
import {
  useAddCard,
  useCardCount,
  useCardIds,
  useDeleteList,
  useList,
  useRenameList,
  useSetListColor,
  useSetListIcon,
  useSetListWidth,
} from "../../store/selectors";
import { LIST_WIDTH_MAX, LIST_WIDTH_MIN } from "../../styles/layout";
import { sortableTransition } from "../../styles/motion";
import { CardItem } from "./CardItem";
import styles from "./ListColumn.module.css";

interface ListColumnProps {
  readonly listId: ListId;
}

/**
 * One column.
 *
 * Like the card, it takes an id and reads its own slices. It subscribes to
 * its own list record, its array of card ids, and the count -- so renaming
 * or deleting a card in this list touches none of those, and this column
 * does not re-render for it.
 *
 * The scroll container lives here rather than on the board, so each column
 * scrolls independently and, later, can be virtualised on its own. The
 * add-card composer sits inside that same scroller, after the cards, so it
 * scrolls with them rather than pinning to the bottom of the column.
 *
 * The whole column is a sortable item -- `setNodeRef` and its transform sit
 * on the outer `<section>`, so the entire column (cards included) slides as
 * one piece when lists reorder. Only the `listeners` that actually start a
 * drag are spread on the header, per the milestone's call for the header to
 * be the drag handle: without that split, grabbing a card would also be a
 * valid pointer-down on the list's own draggable surface.
 */
function ListColumnImpl({ listId }: ListColumnProps) {
  const list = useList(listId);
  const cardIds = useCardIds(listId);
  const cardCount = useCardCount(listId);
  const renameList = useRenameList();
  const deleteList = useDeleteList();
  const addCard = useAddCard();
  const setListColor = useSetListColor();
  const setListIcon = useSetListIcon();
  const setListWidth = useSetListWidth();

  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const customizeTriggerRef = useRef<HTMLButtonElement>(null);
  const columnRef = useRef<HTMLElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  // Drives every card's thots section at once: cycling hidden -> pregame ->
  // postgame -> hidden. Ephemeral UI state, not persisted, same as a card's
  // own `isDescriptionOpen` -- it's just scoped to the whole list instead of
  // one card. Handed down as a prop, so every `CardItem` in this list
  // re-renders when it changes (the point of a bulk toggle) but nothing
  // outside this list is touched.
  const [columnThotsMode, setColumnThotsMode] = useState<"hidden" | "pregame" | "postgame">(
    "hidden",
  );

  function cycleColumnThotsMode() {
    setColumnThotsMode((mode) =>
      mode === "hidden" ? "pregame" : mode === "pregame" ? "postgame" : "hidden",
    );
  }

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: listId,
    data: { type: "list" },
    transition: sortableTransition,
  });

  // Combines dnd-kit's own ref callback with the plain node ref the resize
  // handle needs to read/write the column's live width. Both want the same
  // DOM node; dnd-kit doesn't expose a way to also hand it a ref of ours.
  function setColumnRefs(node: HTMLElement | null) {
    setNodeRef(node);
    columnRef.current = node;
  }

  // Drag-resizes the column from its right edge, Excalidraw-style. Mutates
  // the DOM node's own style directly during the drag -- bypassing React,
  // the same trick dnd-kit uses for its own transforms (see ARCHITECTURE.md)
  // -- rather than pushing every pointer-move pixel through the store: that
  // would re-render this column every frame and, worse, push one history
  // entry per pixel. `setListWidth` is called exactly once, on release, so
  // undo sees the whole resize as a single step.
  function handleResizeStart(event: ReactPointerEvent<HTMLDivElement>) {
    const column = columnRef.current;
    if (!column) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);

    const startX = event.clientX;
    const startWidth = column.getBoundingClientRect().width;
    setIsResizing(true);

    function handlePointerMove(moveEvent: PointerEvent) {
      const nextWidth = clamp(
        startWidth + (moveEvent.clientX - startX),
        LIST_WIDTH_MIN,
        LIST_WIDTH_MAX,
      );
      column!.style.setProperty("--column-width", `${nextWidth}px`);
    }

    function handlePointerUp() {
      handle.removeEventListener("pointermove", handlePointerMove);
      handle.removeEventListener("pointerup", handlePointerUp);
      setIsResizing(false);
      const finalWidth = Math.round(column!.getBoundingClientRect().width);
      if (finalWidth !== Math.round(startWidth)) {
        setListWidth(listId, finalWidth);
      }
    }

    handle.addEventListener("pointermove", handlePointerMove);
    handle.addEventListener("pointerup", handlePointerUp);
  }

  // A double-click on the handle auto-fits the column to its widest card's
  // title, single-line -- the same "double-click a column border" gesture
  // spreadsheets use. With no cards to fit to, there's nothing to measure,
  // so it falls back to clearing the override instead.
  function handleAutoFit() {
    const column = columnRef.current;
    const scroller = scrollerRef.current;
    if (!column || !scroller) {
      return;
    }
    const fitWidth = computeAutoFitWidth(column, scroller);
    setListWidth(listId, fitWidth ?? undefined);
  }

  // `--list-accent` is set here, on the column itself, so it cascades as an
  // ordinary inherited custom property to every card inside -- one value,
  // read back in CardItem.module.css, rather than threading a colour prop
  // through the card tree.
  const accent = list.color ? `var(--palette-${list.color})` : undefined;
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(accent ? ({ "--list-accent": accent } as CSSProperties) : {}),
    ...(list.width ? ({ "--column-width": `${list.width}px` } as CSSProperties) : {}),
  };

  return (
    <section
      ref={setColumnRefs}
      style={style}
      className={`${styles.column} ${isDragging ? styles.dragging : ""} ${isResizing ? styles.resizing : ""}`}
      data-list-id={listId}
    >
      <header className={styles.header} {...attributes} {...listeners}>
        {list.icon && <Icon name={list.icon} className={styles.headerIcon} />}
        <h2 className={styles.title}>
          <InlineEditable
            value={list.title}
            onCommit={(title) => renameList(listId, title)}
            ariaLabel="List title"
          />
        </h2>
        <span className={styles.count}>{cardCount}</span>
        <button
          type="button"
          className={styles.thotsButton}
          onClick={cycleColumnThotsMode}
          aria-label={
            columnThotsMode === "hidden"
              ? "Show pregame thots on every card"
              : columnThotsMode === "pregame"
                ? "Show postgame thots on every card"
                : "Hide thots on every card"
          }
        >
          ▤
        </button>
        <button
          ref={customizeTriggerRef}
          type="button"
          className={styles.customizeButton}
          onClick={() => setIsCustomizeOpen((open) => !open)}
          aria-label="Customise list"
        >
          <span className={styles.customizeSwatch} style={accent ? { background: accent } : undefined} />
        </button>
        <button
          type="button"
          className={styles.deleteButton}
          onClick={() => setIsDeleteConfirmOpen(true)}
          aria-label="Delete list"
        >
          ×
        </button>
      </header>

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{list.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This moves the list, and its {cardCount} card{cardCount === 1 ? "" : "s"}, to the
              trash. You can restore it from there.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => deleteList(listId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isCustomizeOpen && (
        <CustomizePanel
          anchorRef={customizeTriggerRef}
          color={list.color}
          icon={list.icon}
          onColorChange={(color) => setListColor(listId, color)}
          onIconChange={(icon) => setListIcon(listId, icon)}
          onClose={() => setIsCustomizeOpen(false)}
        />
      )}

      <div className={styles.scroller} ref={scrollerRef}>
        {cardIds.length > 0 ? (
          <SortableContext items={[...cardIds]} strategy={verticalListSortingStrategy}>
            <ul className={styles.cards}>
              {cardIds.map((cardId) => (
                <li key={cardId}>
                  <CardItem cardId={cardId} listId={listId} thotsMode={columnThotsMode} />
                </li>
              ))}
            </ul>
          </SortableContext>
        ) : (
          <EmptyListDropZone listId={listId} />
        )}
        <div className={styles.composerSlot}>
          <Composer
            label="Add a card"
            placeholder="Enter a title for this card…"
            onSubmit={(title) => addCard(listId, title)}
          />
        </div>
      </div>

      <div
        className={styles.resizeHandle}
        onPointerDown={handleResizeStart}
        onDoubleClick={handleAutoFit}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize list"
      />
    </section>
  );
}

export const ListColumn = memo(ListColumnImpl);

/**
 * The drop target an empty list needs. A list with cards already offers its
 * cards as collision targets for an incoming drag; an empty one has nothing
 * to hover over, so it needs its own droppable area or a card could never be
 * dropped into it.
 */
function EmptyListDropZone({ listId }: { readonly listId: ListId }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `empty-list-drop:${listId}`,
    data: { type: "list-empty", listId },
  });

  return (
    <div
      ref={setNodeRef}
      className={`${styles.emptyDropZone} ${isOver ? styles.emptyDropZoneOver : ""}`}
    />
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * The width that fits every card's title on one line, spreadsheet-style --
 * or `null` with no cards to measure.
 *
 * Reads real layout rather than reimplementing it: each title (tagged
 * `data-card-title` in CardItem.tsx) is briefly forced to `width:
 * max-content`, which asks the browser for the width it would take with no
 * wrapping -- the one number that would otherwise mean duplicating the
 * title's font, padding and the number badge's width by hand, and then
 * having it drift out of sync with CardItem.module.css. The two loops (set,
 * then read) are split so every title is mutated before any is measured --
 * one forced layout for the batch, not one per card. The gap between a
 * title's own box and the column's outer edge (the card's padding and
 * border, the scroller's padding) is likewise read live via
 * `getComputedStyle` off one real card, rather than repeated as literals
 * that would need to be kept in step with ListColumn.module.css and
 * CardItem.module.css by hand.
 */
function computeAutoFitWidth(column: HTMLElement, scroller: HTMLElement): number | null {
  const titles = column.querySelectorAll<HTMLElement>("[data-card-title]");
  if (titles.length === 0) {
    return null;
  }

  const previousWidths = Array.from(titles, (title) => title.style.width);
  titles.forEach((title) => {
    title.style.width = "max-content";
  });
  let maxTitleWidth = 0;
  titles.forEach((title) => {
    maxTitleWidth = Math.max(maxTitleWidth, title.getBoundingClientRect().width);
  });
  titles.forEach((title, index) => {
    title.style.width = previousWidths[index];
  });

  const card = titles[0].closest<HTMLElement>("[data-card-id]");
  if (!card) {
    return null;
  }
  const cardStyle = getComputedStyle(card);
  const scrollerStyle = getComputedStyle(scroller);
  const columnStyle = getComputedStyle(column);
  const chrome =
    parseFloat(cardStyle.paddingLeft) +
    parseFloat(cardStyle.paddingRight) +
    parseFloat(cardStyle.borderLeftWidth) +
    parseFloat(cardStyle.borderRightWidth) +
    parseFloat(scrollerStyle.paddingLeft) +
    parseFloat(scrollerStyle.paddingRight) +
    parseFloat(columnStyle.borderLeftWidth) +
    parseFloat(columnStyle.borderRightWidth);

  return clamp(Math.ceil(maxTitleWidth + chrome), LIST_WIDTH_MIN, LIST_WIDTH_MAX);
}
