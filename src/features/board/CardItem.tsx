import { memo } from "react";

import type { CardId } from "../../domain/types";
import { useCard } from "../../store/selectors";
import styles from "./CardItem.module.css";

interface CardItemProps {
  readonly cardId: CardId;
}

/**
 * One card.
 *
 * It takes an id, not a card object, and reads its own data from the store.
 * That inversion is what makes the board scale: the parent column renders a
 * list of ids it already has, so adding a card re-renders the column but not
 * its existing siblings, and editing a card re-renders only that card.
 *
 * `memo` completes the picture. The only prop is a string id, so when the
 * column re-renders for an unrelated reason every untouched card bails out on
 * a single reference comparison.
 */
function CardItemImpl({ cardId }: CardItemProps) {
  const card = useCard(cardId);

  return (
    <article className={styles.card} data-card-id={cardId}>
      <p className={styles.title}>{card.title}</p>
    </article>
  );
}

export const CardItem = memo(CardItemImpl);
