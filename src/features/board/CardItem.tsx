import { memo } from "react";

import { InlineEditable } from "../../components/InlineEditable";
import type { CardId, ListId } from "../../domain/types";
import { useCard, useDeleteCard, useRenameCard } from "../../store/selectors";
import styles from "./CardItem.module.css";

interface CardItemProps {
  readonly cardId: CardId;
  readonly listId: ListId;
}

/**
 * One card.
 *
 * It takes an id, not a card object, and reads its own data from the store.
 * That inversion is what makes the board scale: the parent column renders a
 * list of ids it already has, so adding a card re-renders the column but not
 * its existing siblings, and editing a card re-renders only that card.
 *
 * `listId` is a second prop because deletion needs it -- a card's own record
 * has no back-reference to its list, so `deleteCard` needs to be told which
 * `cardOrder` array to splice it out of.
 *
 * `memo` completes the picture. The only props are two string ids, so when
 * the column re-renders for an unrelated reason every untouched card bails
 * out on a shallow prop comparison.
 */
function CardItemImpl({ cardId, listId }: CardItemProps) {
  const card = useCard(cardId);
  const renameCard = useRenameCard();
  const deleteCard = useDeleteCard();

  return (
    <article className={styles.card} data-card-id={cardId}>
      <p className={styles.title}>
        <InlineEditable
          value={card.title}
          onCommit={(title) => renameCard(cardId, title)}
          ariaLabel="Card title"
        />
      </p>
      <button
        type="button"
        className={styles.deleteButton}
        onClick={() => deleteCard(listId, cardId)}
        aria-label="Delete card"
      >
        ×
      </button>
    </article>
  );
}

export const CardItem = memo(CardItemImpl);
