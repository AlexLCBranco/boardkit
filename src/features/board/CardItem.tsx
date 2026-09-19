import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { memo, useEffect, useRef, useState, type CSSProperties } from "react";

import { CustomizePanel } from "../../components/CustomizePanel";
import { InlineEditable } from "../../components/InlineEditable";
import { DropdownMenu, DropdownMenuTrigger } from "../../components/ui/dropdown-menu";
import type { CardId, ListId } from "../../domain/types";
import {
  useCard,
  useCardNumber,
  useDeleteCard,
  useIsCardSelected,
  useRenameCard,
  useSetCardColor,
  useSetCardDescription,
  useSetCardPostgameDescription,
} from "../../store/selectors";
import { sortableTransition } from "../../styles/motion";
import styles from "./CardItem.module.css";
import { CardTransferContent } from "./TransferMenus";

interface CardItemProps {
  readonly cardId: CardId;
  readonly listId: ListId;
  /** The list's bulk thots cycle (see ListColumn) -- applied here via
      effect, below, so it overrides this card's own open/slot state
      whenever the list-wide control changes, without taking away this
      card's ability to be toggled individually the rest of the time. */
  readonly thotsMode: "hidden" | "pregame" | "postgame";
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
function CardItemImpl({ cardId, listId, thotsMode }: CardItemProps) {
  const card = useCard(cardId);
  const renameCard = useRenameCard();
  const deleteCard = useDeleteCard();
  const setCardColor = useSetCardColor();
  const setCardDescription = useSetCardDescription();
  const setCardPostgameDescription = useSetCardPostgameDescription();
  const number = useCardNumber(listId, cardId);
  const isSelected = useIsCardSelected(cardId);

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

  // Reruns only when the list's bulk control (ListColumn's `columnThotsMode`)
  // actually changes, forcing every card in the list to the same slot in
  // one stroke. Between those changes, this card's own controls are free to
  // diverge again -- the effect doesn't run just because local state does.
  useEffect(() => {
    if (thotsMode === "hidden") {
      setIsDescriptionOpen(false);
      return;
    }
    setThotsSlot(thotsMode);
    setIsDescriptionOpen(true);
  }, [thotsMode]);

  // Right-click toggles the thots section instead of opening the browser's
  // context menu -- the only way in while it's collapsed, since the row
  // below isn't in the DOM at all until then (no reserved space, nothing to
  // hover or click). Always intercepted, so the native menu never shows on
  // a card.
  function handleCardContextMenu(event: React.MouseEvent<HTMLElement>) {
    event.preventDefault();
    setIsDescriptionOpen((open) => !open);
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
      className={`${styles.card} ${isDragging ? styles.dragging : ""} ${isSelected ? styles.selected : ""}`}
      data-card-id={cardId}
      onContextMenu={handleCardContextMenu}
      {...attributes}
      {...listeners}
    >
      <p className={styles.title} data-card-title>
        {number !== null && <span className={styles.number}>{number}</span>}
        <InlineEditable
          value={card.title}
          onCommit={(title) => renameCard(cardId, title)}
          ariaLabel="Card title"
        />
      </p>
      {isDescriptionOpen && (
        <div className={styles.descriptionRow}>
          <button
            type="button"
            className={styles.descriptionToggle}
            onClick={() => setIsDescriptionOpen(false)}
            aria-expanded={isDescriptionOpen}
          >
            ▾ {thotsSlot === "pregame" ? "pregame thots" : "postgame thots"}
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
      )}
      {isDescriptionOpen &&
        (thotsSlot === "pregame" ? (
          <div className={styles.description} key="pregame">
            <InlineEditable
              value={card.description ?? ""}
              onCommit={(description) => setCardDescription(cardId, description || undefined)}
              ariaLabel="Pregame thots"
              placeholder="Add your pregame thots…"
              multiline
              linkify
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
              linkify
            />
          </div>
        ))}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={styles.moveButton}
            aria-label="Move or copy card to another board"
          >
            →
          </button>
        </DropdownMenuTrigger>
        <CardTransferContent cardId={cardId} listId={listId} />
      </DropdownMenu>
      <button
        type="button"
        className={styles.thotsButton}
        onClick={() => setIsDescriptionOpen((open) => !open)}
        aria-label={isDescriptionOpen ? "Hide pregame thots" : "Show pregame thots"}
        aria-expanded={isDescriptionOpen}
      >
        ▤
      </button>
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
