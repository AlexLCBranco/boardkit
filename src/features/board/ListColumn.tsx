import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { memo } from "react";

import { Composer } from "../../components/Composer";
import { InlineEditable } from "../../components/InlineEditable";
import type { ListId } from "../../domain/types";
import {
  useAddCard,
  useCardCount,
  useCardIds,
  useDeleteList,
  useList,
  useRenameList,
} from "../../store/selectors";
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
 */
function ListColumnImpl({ listId }: ListColumnProps) {
  const list = useList(listId);
  const cardIds = useCardIds(listId);
  const cardCount = useCardCount(listId);
  const renameList = useRenameList();
  const deleteList = useDeleteList();
  const addCard = useAddCard();

  return (
    <section className={styles.column} data-list-id={listId}>
      <header className={styles.header}>
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
          className={styles.deleteButton}
          onClick={() => deleteList(listId)}
          aria-label="Delete list"
        >
          ×
        </button>
      </header>

      <div className={styles.scroller}>
        {cardIds.length > 0 && (
          <SortableContext items={[...cardIds]} strategy={verticalListSortingStrategy}>
            <ul className={styles.cards}>
              {cardIds.map((cardId) => (
                <li key={cardId}>
                  <CardItem cardId={cardId} listId={listId} />
                </li>
              ))}
            </ul>
          </SortableContext>
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
