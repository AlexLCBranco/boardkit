import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { memo, useRef, useState, type CSSProperties } from "react";

import { CustomizePanel } from "../../components/CustomizePanel";
import { InlineEditable } from "../../components/InlineEditable";
import type { CardId, ListId } from "../../domain/types";
import {
  useCard,
  useCardNumber,
  useDeleteCard,
  useRenameCard,
  useSetCardColor,
  useSetCardDescription,
  useSetCardPostgameDescription,
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
  const setCardDescription = useSetCardDescription();
  const setCardPostgameDescription = useSetCardPostgameDescription();
  const number = useCardNumber(listId, cardId);

  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const customizeTriggerRef = useRef<HTMLButtonElement>(null);
  // Collapsed by default so a description doesn't inflate every card's
  // height on a board with hundreds of them -- purely local, ephemeral
  // display state, not worth persisting across a reload. `thotsSlot` is the
  // same kind of state: which of the two fields is currently shown, not
  // which ones exist -- that lives on the card itself.
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(false);
  const [thotsSlot, setThotsSlot] = useState<"pregame" | "postgame">("pregame");

  function flipThotsSlot() {
    setThotsSlot((slot) => (slot === "pregame" ? "postgame" : "pregame"));
    setIsDescriptionOpen(true);
  }

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
  // fallback in CardItem.module.css tints the card with the list's accent
  // instead.
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
        {number !== null && <span className={styles.number}>{number}</span>}
        <InlineEditable
          value={card.title}
          onCommit={(title) => renameCard(cardId, title)}
          ariaLabel="Card title"
        />
      </p>
      <div className={styles.descriptionRow}>
        <button
          type="button"
          className={styles.descriptionToggle}
          onClick={() => setIsDescriptionOpen((open) => !open)}
          aria-expanded={isDescriptionOpen}
        >
          {isDescriptionOpen ? "▾" : "▸"} {thotsSlot === "pregame" ? "pregame thots" : "postgame thots"}
        </button>
        <button
          type="button"
          className={styles.descriptionFlip}
          onClick={flipThotsSlot}
          aria-label="Switch between pregame and postgame thots"
        >
          ⇄
        </button>
      </div>
      {isDescriptionOpen &&
        (thotsSlot === "pregame" ? (
          <div className={styles.description} key="pregame">
            <InlineEditable
              value={card.description ?? ""}
              onCommit={(description) => setCardDescription(cardId, description || undefined)}
              ariaLabel="Pregame thots"
              placeholder="Add your pregame thots…"
              multiline
            />
          </div>
        ) : (
          <div className={styles.description} key="postgame">
            <InlineEditable
              value={card.postgameDescription ?? ""}
              onCommit={(description) =>
                setCardPostgameDescription(cardId, description || undefined)
              }
              ariaLabel="Postgame thots"
              placeholder="Add your postgame thots…"
              multiline
            />
          </div>
        ))}
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
          onColorChange={(color) => setCardColor(cardId, color)}
          onClose={() => setIsCustomizeOpen(false)}
        />
      )}
    </article>
  );
}

export const CardItem = memo(CardItemImpl);
