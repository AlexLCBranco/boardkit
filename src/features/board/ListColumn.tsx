import { memo } from "react";

import type { ListId } from "../../domain/types";
import { useCardCount, useCardIds, useList } from "../../store/selectors";
import { CardItem } from "./CardItem";
import styles from "./ListColumn.module.css";

interface ListColumnProps {
  readonly listId: ListId;
}

/**
 * One column.
 *
 * Like the card, it takes an id and reads its own slices. It subscribes to
 * three narrow things: the list's own record, its array of card ids, and the
 * count. Editing a card's title touches none of them, so a rename inside this
 * column does not re-render the column itself.
 *
 * The scroll container lives here rather than on the board, so each column
 * scrolls independently and, later, can be virtualised on its own.
 */
function ListColumnImpl({ listId }: ListColumnProps) {
  const list = useList(listId);
  const cardIds = useCardIds(listId);
  const cardCount = useCardCount(listId);

  return (
    <section className={styles.column} data-list-id={listId}>
      <header className={styles.header}>
        <h2 className={styles.title}>{list.title}</h2>
        <span className={styles.count}>{cardCount}</span>
      </header>

      <div className={styles.scroller}>
        {cardIds.length === 0 ? (
          <p className={styles.empty}>Empty</p>
        ) : (
          <ul className={styles.cards}>
            {cardIds.map((cardId) => (
              <li key={cardId}>
                <CardItem cardId={cardId} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export const ListColumn = memo(ListColumnImpl);
