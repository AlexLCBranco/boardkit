import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { memo, useRef, useState, type CSSProperties } from "react";

import { Composer } from "../../components/Composer";
import { CustomizePanel } from "../../components/CustomizePanel";
import { Icon } from "../../components/Icon";
import { InlineEditable } from "../../components/InlineEditable";
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
} from "../../store/selectors";
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

  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const customizeTriggerRef = useRef<HTMLButtonElement>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: listId,
    data: { type: "list" },
    transition: sortableTransition,
  });

  // `--list-accent` is set here, on the column itself, so it cascades as an
  // ordinary inherited custom property to every card inside -- one value,
  // read back in CardItem.module.css, rather than threading a colour prop
  // through the card tree.
  const accent = list.color ? `var(--palette-${list.color})` : undefined;
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(accent ? ({ "--list-accent": accent } as CSSProperties) : {}),
  };

  return (
    <section
      ref={setNodeRef}
      style={style}
      className={`${styles.column} ${isDragging ? styles.dragging : ""}`}
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
          onClick={() => deleteList(listId)}
          aria-label="Delete list"
        >
          ×
        </button>
      </header>

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

      <div className={styles.scroller}>
        {cardIds.length > 0 ? (
          <SortableContext items={[...cardIds]} strategy={verticalListSortingStrategy}>
            <ul className={styles.cards}>
              {cardIds.map((cardId) => (
                <li key={cardId}>
                  <CardItem cardId={cardId} listId={listId} />
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
