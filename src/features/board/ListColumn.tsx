import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  memo,
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

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
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "../../components/ui/context-menu";
import { MAX_CARDS_PER_LIST, cardRoom } from "../../domain/limits";
import { accentCss } from "../../domain/colors";
import type { ItemColor, ListId } from "../../domain/types";
import {
  useAddCard,
  useCardCount,
  useCardIds,
  useCardNumbers,
  useClearClipboard,
  useClipboardCount,
  useIsFirstList,
  useIsNumberingContinued,
  useIsListFull,
  useDeleteList,
  useDuplicateList,
  useList,
  usePasteInto,
  useRenameList,
  useSetListColor,
  useSetListContinuesNumbering,
  useSetListIcon,
  useSetListWidths,
} from "../../store/selectors";
import { LIST_WIDTH_MAX, LIST_WIDTH_MIN } from "../../styles/layout";
import { sortableTransition } from "../../styles/motion";
import { CardItem } from "./CardItem";
import { copyAsImage } from "./copyAsImage";
import styles from "./ListColumn.module.css";
import { ListTransferItems } from "./TransferMenus";

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
 * scrolls independently. The add-card composer sits inside that same
 * scroller, after the cards, so it scrolls with them rather than pinning to
 * the bottom of the column. Once the list reaches its card limit
 * (`domain/limits.ts`) a short note takes the composer's place.
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
  const isFull = useIsListFull(listId);
  const renameList = useRenameList();
  const deleteList = useDeleteList();
  const duplicateList = useDuplicateList();
  const addCard = useAddCard();
  const clipboardCount = useClipboardCount();
  const pasteInto = usePasteInto();
  const clearClipboard = useClearClipboard();
  const setListColor = useSetListColor();
  const setListIcon = useSetListIcon();
  const setListWidths = useSetListWidths();
  const cardNumbers = useCardNumbers(listId);
  const isFirstList = useIsFirstList(listId);
  // True when the list to the right continues from this one, so this list
  // opens (or sits inside) a numbering run and shows its range as well.
  const isNumberingContinued = useIsNumberingContinued(listId);
  const setListContinuesNumbering = useSetListContinuesNumbering();
  // Continuing only means anything with a list to the left. A leftmost list
  // that was set to continue keeps the flag (so moving it back restores the
  // link) but shows and behaves as if it weren't.
  const continuesNumbering = !isFirstList && list.continuesNumbering === true;
  // Memoised so the first card gets the same function every render and its
  // `memo` still holds; it only changes when the flag itself does.
  const toggleContinuesNumbering = useCallback(
    () => setListContinuesNumbering(listId, !continuesNumbering),
    [setListContinuesNumbering, listId, continuesNumbering],
  );
  const firstNumberedIndex = cardNumbers.findIndex((number) => number !== null);

  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  // A colour being tried in the customise panel's picker, shown before it is
  // saved. Local state, so previewing never touches the store or undo stack.
  const [previewColor, setPreviewColor] = useState<ItemColor | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
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
  // each affected DOM node's own style directly during the drag -- bypassing
  // React, the same trick dnd-kit uses for its own transforms (see
  // ARCHITECTURE.md) -- rather than pushing every pointer-move pixel through
  // the store: that would re-render every affected column every frame and,
  // worse, push one history entry per pixel. `setListWidths` is called
  // exactly once, on release, so undo sees the whole gesture as a single
  // step, even when it touched every list on the board.
  //
  // Two modifiers, both reaching every column via `getAllColumns` (a plain
  // DOM query rather than a registry of every column's ref, since every
  // column already carries `data-list-id` for other reasons):
  //  - Alt keeps each column's own size, offsetting all of them by the same
  //    pixel delta -- widths that were different stay different.
  //  - Shift makes every column track *this* column's live width instead of
  //    its own -- the way to get them all equal, since the fixed points
  //    (the columns' own starting widths) are exactly what Alt preserves.
  function handleResizeStart(event: ReactPointerEvent<HTMLDivElement>) {
    const column = columnRef.current;
    if (!column) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);

    const grabbedColumn = column;
    const matchThisColumn = event.shiftKey;
    const columns = event.altKey || matchThisColumn ? getAllColumns() : [grabbedColumn];
    const startX = event.clientX;
    const startWidths = new Map(columns.map((col) => [col, col.getBoundingClientRect().width]));
    columns.forEach((col) => col.classList.add(styles.resizing));
    setIsResizing(true);

    function handlePointerMove(moveEvent: PointerEvent) {
      const dx = moveEvent.clientX - startX;
      if (matchThisColumn) {
        const sharedWidth = clamp(
          startWidths.get(grabbedColumn)! + dx,
          LIST_WIDTH_MIN,
          LIST_WIDTH_MAX,
        );
        columns.forEach((col) => col.style.setProperty("--column-width", `${sharedWidth}px`));
        return;
      }
      columns.forEach((col) => {
        const nextWidth = clamp(startWidths.get(col)! + dx, LIST_WIDTH_MIN, LIST_WIDTH_MAX);
        col.style.setProperty("--column-width", `${nextWidth}px`);
      });
    }

    function handlePointerUp() {
      handle.removeEventListener("pointermove", handlePointerMove);
      handle.removeEventListener("pointerup", handlePointerUp);
      setIsResizing(false);
      columns.forEach((col) => col.classList.remove(styles.resizing));

      const updates: Record<ListId, number> = {};
      let changed = false;
      columns.forEach((col) => {
        const finalWidth = Math.round(col.getBoundingClientRect().width);
        if (finalWidth !== Math.round(startWidths.get(col)!)) {
          changed = true;
        }
        updates[col.dataset.listId as ListId] = finalWidth;
      });
      if (changed) {
        setListWidths(updates);
      }
    }

    handle.addEventListener("pointermove", handlePointerMove);
    handle.addEventListener("pointerup", handlePointerUp);
  }

  // A double-click on the handle auto-fits the column to its widest card's
  // title, single-line -- the same "double-click a column border" gesture
  // spreadsheets use. Alt+double-click does it for every column on the
  // board in one step, each fit to its own cards (so they can still end up
  // different widths). Shift+double-click instead copies *this* column's
  // current width onto every other one, unmeasured -- the equal-widths case,
  // same division of labour as the drag above. With no cards to fit to, a
  // plain or Alt double-click falls back to clearing that column's override.
  function handleAutoFit(event: ReactMouseEvent<HTMLDivElement>) {
    const column = columnRef.current;

    if (event.shiftKey) {
      if (!column) {
        return;
      }
      const sharedWidth = Math.round(column.getBoundingClientRect().width);
      const updates: Record<ListId, number> = {};
      for (const col of getAllColumns()) {
        updates[col.dataset.listId as ListId] = sharedWidth;
      }
      setListWidths(updates);
      return;
    }

    if (!event.altKey) {
      const scroller = scrollerRef.current;
      if (!column || !scroller) {
        return;
      }
      setListWidths({ [listId]: computeAutoFitWidth(column, scroller) ?? undefined });
      return;
    }

    const updates: Record<ListId, number | undefined> = {};
    for (const col of getAllColumns()) {
      const scroller = col.querySelector<HTMLElement>("[data-list-scroller]");
      if (!scroller) {
        continue;
      }
      updates[col.dataset.listId as ListId] = computeAutoFitWidth(col, scroller) ?? undefined;
    }
    setListWidths(updates);
  }

  // Rasterises the column at a high pixel density -- well beyond the
  // screen's own resolution -- so pasting into a tool like Excalidraw and
  // resizing there still has real pixels to sample down from, instead of
  // the soft, blocky result a normal screenshot gives once it's stretched.
  // Buttons and the resize handle (each tagged `data-capture-exclude`) are
  // left out, so the image is just the list's content.
  async function handleCopyImage() {
    const column = columnRef.current;
    if (!column) {
      return;
    }
    try {
      await copyAsImage(column, { pixelRatio: 4 });
      setCopyState("copied");
    } catch (error) {
      console.error("copy list as image failed", error);
      setCopyState("error");
    } finally {
      setTimeout(() => setCopyState("idle"), 1500);
    }
  }

  // `--list-accent` is set here, on the column itself, so it cascades as an
  // ordinary inherited custom property to every card inside -- one value,
  // read back in CardItem.module.css, rather than threading a colour prop
  // through the card tree.
  const color = previewColor ?? list.color;
  const accent = color ? accentCss(color) : undefined;
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
      {/* The menu wraps the header only, and its content portals out, so
          clicks inside it never bubble through the header's drag listeners. */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
      <header className={styles.header} data-list-header {...attributes} {...listeners}>
        {list.icon && <Icon name={list.icon} className={styles.headerIcon} />}
        <h2 className={styles.title}>
          <InlineEditable
            value={list.title}
            onCommit={(title) => renameList(listId, title)}
            ariaLabel="List title"
            allowEmpty
          />
        </h2>
        {continuesNumbering || isNumberingContinued ? (
          <span
            className={styles.count}
            title={`${cardCount} card${cardCount === 1 ? "" : "s"}, numbered ${
              continuesNumbering ? "on from the previous list" : "on into the next list"
            }`}
          >
            {numberRange(cardNumbers) ?? cardCount}
          </span>
        ) : (
          <span className={styles.count}>{cardCount}</span>
        )}
        <button
          type="button"
          className={styles.thotsButton}
          onClick={cycleColumnThotsMode}
          data-capture-exclude="true"
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
          type="button"
          className={styles.copyButton}
          onClick={handleCopyImage}
          data-capture-exclude="true"
          aria-label="Copy list as image"
          title="Copy list as image"
        >
          {copyState === "copied" ? "✓" : copyState === "error" ? "!" : "⧉"}
        </button>
        <button
          ref={customizeTriggerRef}
          type="button"
          className={styles.customizeButton}
          onClick={() => setIsCustomizeOpen((open) => !open)}
          data-capture-exclude="true"
          aria-label="Customise list"
        >
          <span className={styles.customizeSwatch} style={accent ? { background: accent } : undefined} />
        </button>
        <button
          type="button"
          className={styles.deleteButton}
          onClick={() => setIsDeleteConfirmOpen(true)}
          data-capture-exclude="true"
          aria-label="Delete list"
        >
          ×
        </button>
      </header>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => duplicateList(listId)}>Duplicate list</ContextMenuItem>
          <ContextMenuCheckboxItem
            checked={continuesNumbering}
            disabled={isFirstList}
            onCheckedChange={(checked) => setListContinuesNumbering(listId, checked)}
          >
            Continue numbering from previous list
          </ContextMenuCheckboxItem>
          <ListTransferItems listId={listId} />
        </ContextMenuContent>
      </ContextMenu>

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {list.title ? `"${list.title}"` : "this list"}?</AlertDialogTitle>
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
          onColorChange={(next) => setListColor(listId, next)}
          onColorPreview={setPreviewColor}
          onIconChange={(icon) => setListIcon(listId, icon)}
          onClose={() => setIsCustomizeOpen(false)}
        />
      )}

      <div className={styles.scroller} ref={scrollerRef} data-list-scroller>
        {cardIds.length > 0 ? (
          <SortableContext items={[...cardIds]} strategy={verticalListSortingStrategy}>
            <ul className={styles.cards}>
              {cardIds.map((cardId, index) => (
                <li key={cardId}>
                  <CardItem
                    cardId={cardId}
                    listId={listId}
                    thotsMode={columnThotsMode}
                    number={cardNumbers[index] ?? null}
                    onNumberClick={
                      !isFirstList && index === firstNumberedIndex
                        ? toggleContinuesNumbering
                        : undefined
                    }
                    continuesNumbering={continuesNumbering}
                  />
                </li>
              ))}
            </ul>
          </SortableContext>
        ) : (
          <EmptyListDropZone listId={listId} />
        )}
        <div className={styles.composerSlot}>
          {clipboardCount > 0 && !isFull && (
            <div className={styles.pasteRow} data-capture-exclude="true">
              <button
                type="button"
                className={styles.pasteButton}
                onClick={() => pasteInto(listId)}
              >
                {pasteLabel(clipboardCount, cardRoom(cardIds))}
              </button>
              <button
                type="button"
                className={styles.pasteDismiss}
                onClick={clearClipboard}
                aria-label="Cancel paste"
                title="Cancel paste"
              >
                ×
              </button>
            </div>
          )}
          {isFull ? (
            <p className={styles.fullNote} data-capture-exclude="true">
              List is full · {MAX_CARDS_PER_LIST} cards max
            </p>
          ) : (
            <Composer
              label="Add a card"
              placeholder="Enter a title for this card…"
              onSubmit={(title) => addCard(listId, title)}
            />
          )}
        </div>
      </div>

      <div
        className={styles.resizeHandle}
        onPointerDown={handleResizeStart}
        onDoubleClick={handleAutoFit}
        data-capture-exclude="true"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize list"
        title="Drag to resize, double-click to fit&#10;Alt: every list at once&#10;Shift: match every list to this one"
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

/** The pill of a list in a numbering run: "5–7", or just "5" for a single numbered card.
    `null` when nothing in the list is numbered, so the pill falls back to
    the plain count. Numbers only ever go up, so the first and last non-null
    entries are the range. */
function numberRange(numbers: readonly (number | null)[]): string | null {
  const numbered = numbers.filter((number) => number !== null);
  if (numbered.length === 0) {
    return null;
  }
  const first = numbered[0];
  const last = numbered[numbered.length - 1];
  return first === last ? `${first}` : `${first}–${last}`;
}

/** "Paste 3 cards", or "Paste 2 of 5 cards" when the list can only take part
    of the clipboard -- the paste says up front what it will leave out. */
function pasteLabel(count: number, room: number): string {
  const noun = count === 1 ? "card" : "cards";
  return room >= count ? `Paste ${count} ${noun}` : `Paste ${room} of ${count} ${noun}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Every column currently on the board, in DOM order. A plain query rather
    than a ref registry: `data-list-id` already exists on each column
    (drag data, this same handle's own lookup), so an Alt-modified resize or
    auto-fit can reach every other column without any new plumbing between
    sibling `ListColumn` instances. */
function getAllColumns(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-list-id]"));
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
