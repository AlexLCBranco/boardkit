import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { memo, useRef, useState, type CSSProperties } from "react";

import { CustomizePanel } from "../../components/CustomizePanel";
import { Icon } from "../../components/Icon";
import { InlineEditable } from "../../components/InlineEditable";
import type { CardId, ListId } from "../../domain/types";
import {
  useCard,
  useCardNumber,
  useDeleteCard,
  useRenameCard,
  useSetCardColor,
  useSetCardIcon,
} from "../../store/selectors";
import { sortableTransition } from "../../styles/motion";
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
  const setCardColor = useSetCardColor();
  const setCardIcon = useSetCardIcon();
  const number = useCardNumber(listId, cardId);

  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const customizeTriggerRef = useRef<HTMLButtonElement>(null);

  // `data: { listId }` is read back in DragContext's onDragEnd -- a card
  // carries no list back-reference in the store, so the drag data is the
  // only place that membership is available at drop time.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cardId,
    data: { type: "card", listId },
    transition: sortableTransition,
  });

  // A card's own colour overrides the list's cascaded `--list-accent`; with
  // no colour of its own, `--card-accent` is simply left unset and the CSS
  // fallback in CardItem.module.css reads the list's accent instead.
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(card.color ? ({ "--card-accent": `var(--palette-${card.color})` } as CSSProperties) : {}),
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`${styles.card} ${isDragging ? styles.dragging : ""}`}
      data-card-id={cardId}
      {...attributes}
      {...listeners}
    >
      <p className={styles.title}>
        {card.icon && <Icon name={card.icon} className={styles.cardIcon} />}
        {number !== null && <span className={styles.number}>{number}</span>}
        <InlineEditable
          value={card.title}
          onCommit={(title) => renameCard(cardId, title)}
          ariaLabel="Card title"
        />
      </p>
      <button
        ref={customizeTriggerRef}
        type="button"
        className={styles.customizeButton}
        onClick={() => setIsCustomizeOpen((open) => !open)}
        aria-label="Customise card"
      >
        <span className={styles.customizeSwatch} style={card.color ? { background: `var(--palette-${card.color})` } : undefined} />
      </button>
      <button
        type="button"
        className={styles.deleteButton}
        onClick={() => deleteCard(listId, cardId)}
        aria-label="Delete card"
      >
        ×
      </button>

      {isCustomizeOpen && (
        <CustomizePanel
          anchorRef={customizeTriggerRef}
          color={card.color}
          icon={card.icon}
          onColorChange={(color) => setCardColor(cardId, color)}
          onIconChange={(icon) => setCardIcon(cardId, icon)}
          onClose={() => setIsCustomizeOpen(false)}
        />
      )}
    </article>
  );
}

export const CardItem = memo(CardItemImpl);
