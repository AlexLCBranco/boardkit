import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useState, type CSSProperties, type ReactNode } from "react";

import { inkOf, specOf } from "../../domain/cardKinds";
import { accentCss } from "../../domain/colors";
import type { CardId, ListId } from "../../domain/types";
import {
  useCard,
  useCardCount,
  useCardNumber,
  useList,
  useMoveCardBetweenLists,
  useReorderCardsWithinList,
  useReorderLists,
} from "../../store/selectors";
import { useResolvedTheme } from "../../store/themeStore";
import cardStyles from "./CardItem.module.css";
import listStyles from "./ListColumn.module.css";

/**
 * The `data` every draggable and droppable in the board carries. It is how
 * the handlers below tell a card drag from a list drag, and a card from an
 * empty-list drop target, without caring what shape each id string happens
 * to have.
 */
type DragData =
  | { readonly type: "card"; readonly listId: ListId }
  | { readonly type: "list" }
  | { readonly type: "list-empty"; readonly listId: ListId };

type ActiveDrag =
  | { readonly kind: "card"; readonly id: CardId; readonly listId: ListId }
  | { readonly kind: "list"; readonly id: ListId }
  | null;

function dragDataOf(entity: { data: { current?: unknown } }): DragData | undefined {
  return entity.data.current as DragData | undefined;
}

/**
 * Owns the one `DndContext` the board uses, its sensors and its collision
 * strategy, so drag configuration never scatters across components. It now
 * carries two kinds of drag -- a card, or a whole list -- distinguished by
 * the `data` each draggable registers, rather than by having two contexts.
 *
 * A pointer needs a few pixels of movement before a drag starts -- without
 * that constraint, `onClick` on a card (inline editing, delete) would never
 * fire, because every click begins as a pointer-down dnd-kit could otherwise
 * interpret as a drag. The keyboard sensor is close to free once the pointer
 * sensor exists, and it is the only way to reorder a card without a mouse.
 */
export function BoardDragContext({ children }: { readonly children: ReactNode }) {
  const [activeDrag, setActiveDrag] = useState<ActiveDrag>(null);
  const reorderCardsWithinList = useReorderCardsWithinList();
  const moveCardBetweenLists = useMoveCardBetweenLists();
  const reorderLists = useReorderLists();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /**
   * Restricts collision candidates to the active drag's own kind before
   * measuring distance. Without this, a card lifted near a list's header
   * (its drag handle) could resolve as "over" the list-reorder target
   * instead of the card or empty-list drop zone underneath it, and a
   * dragged list could snap to a card by mistake.
   */
  const collisionDetection: CollisionDetection = (args) => {
    const activeIsList = dragDataOf(args.active)?.type === "list";
    const compatible = args.droppableContainers.filter((container) => {
      const containerType = dragDataOf(container)?.type;
      return activeIsList ? containerType === "list" : containerType !== "list";
    });
    return closestCenter({ ...args, droppableContainers: compatible });
  };

  function handleDragStart(event: DragStartEvent) {
    const data = dragDataOf(event.active);
    if (data?.type === "list") {
      setActiveDrag({ kind: "list", id: event.active.id as ListId });
    } else if (data?.type === "card") {
      setActiveDrag({ kind: "card", id: event.active.id as CardId, listId: data.listId });
    }
  }

  /**
   * Fires continuously while dragging, not just on drop. A card is moved
   * into the list it is currently hovering over as soon as it crosses the
   * boundary, so that list visibly opens a gap for it -- the alternative,
   * waiting for drop, would leave the card looking like it belongs to its
   * old list right up until release. Reordering within the list the card
   * already lives in is left to the sortable preview and committed only in
   * `handleDragEnd`, exactly as milestone 4 already does it.
   */
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) {
      return;
    }

    const activeData = dragDataOf(active);
    if (activeData?.type !== "card") {
      return;
    }

    const overData = dragDataOf(over);
    if (overData?.type !== "card" && overData?.type !== "list-empty") {
      return;
    }

    const toListId = overData.listId;
    if (toListId === activeData.listId) {
      return;
    }

    const overCardId = overData.type === "card" ? (over.id as CardId) : null;
    moveCardBetweenLists(active.id as CardId, activeData.listId, toListId, overCardId);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over) {
      return;
    }

    const activeData = dragDataOf(active);

    if (activeData?.type === "list") {
      if (active.id !== over.id) {
        reorderLists(active.id as ListId, over.id as ListId);
      }
      return;
    }

    if (activeData?.type === "card") {
      const overData = dragDataOf(over);
      // A drop on an empty list was already placed by handleDragOver above;
      // only a drop on another card still needs its final position committed.
      // That card must be in the dragged card's own list: if it isn't, the
      // destination was full and refused the card, so there is nothing to do.
      if (
        overData?.type === "card" &&
        overData.listId === activeData.listId &&
        over.id !== active.id
      ) {
        reorderCardsWithinList(activeData.listId, active.id as CardId, over.id as CardId);
      }
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDrag(null)}
    >
      {children}
      <DragOverlay>
        {activeDrag?.kind === "card" && (
          <CardOverlay cardId={activeDrag.id} listId={activeDrag.listId} />
        )}
        {activeDrag?.kind === "list" && <ListOverlay listId={activeDrag.id} />}
      </DragOverlay>
    </DndContext>
  );
}

/**
 * The lifted copy dnd-kit renders under the pointer. It is a plain read of
 * the card's title -- no editing, no delete button -- since it exists purely
 * as a drag affordance, not an interactive element.
 *
 * It still needs to look like the card it's a copy of, though: colour and
 * the pregame/postgame-thots label. The overlay is portalled outside the
 * list's own DOM subtree (dnd-kit renders it at the document root), so it
 * can't pick up `--list-accent` by CSS inheritance the way the real card
 * does -- both `--card-accent` and `--list-accent` are set here explicitly
 * instead, from `listId` (carried on `activeDrag` for exactly this), so the
 * same `cardStyles.card` background rule resolves to the same colour either
 * way.
 */
function CardOverlay({ cardId, listId }: { readonly cardId: CardId; readonly listId: ListId }) {
  const card = useCard(cardId);
  const list = useList(listId);
  const number = useCardNumber(cardId);

  const style: CSSProperties = {
    ...(card.color ? ({ "--card-accent": accentCss(card.color) } as CSSProperties) : {}),
    ...(list.color ? ({ "--list-accent": accentCss(list.color) } as CSSProperties) : {}),
  };
  const theme = useResolvedTheme();
  const ink = inkOf(card, list.color, theme);

  return (
    <article
      className={`${cardStyles.card} ${card.kind ? cardStyles[card.kind] : ""} ${cardStyles.overlay}`}
      style={style}
      data-ink={ink === "default" ? undefined : ink}
      data-numbered={number !== null ? "" : undefined}
    >
      {/* A zero-width space keeps a blank title one line tall, as on the card. */}
      <p className={cardStyles.title}>
        {number !== null && <span className={cardStyles.number}>{number}</span>}
        {card.title || "​"}
      </p>
      {specOf(card).hasThots && (card.description || card.postgameDescription) && (
        <div className={cardStyles.descriptionToggle}>▸ pregame thots</div>
      )}
    </article>
  );
}

/**
 * The lifted copy for a list drag. It shows only the header -- title and
 * card count -- rather than re-rendering every card in the list under the
 * pointer, which keeps picking up a list cheap even when it holds hundreds
 * of cards.
 */
function ListOverlay({ listId }: { readonly listId: ListId }) {
  const list = useList(listId);
  const cardCount = useCardCount(listId);

  // Same reasoning as CardOverlay above: portalled outside the column's own
  // DOM subtree, so it can't inherit `--list-accent` (or a custom width) by
  // cascade and needs both set explicitly to keep looking like the column
  // being dragged.
  const style: CSSProperties = {
    ...(list.color ? ({ "--list-accent": accentCss(list.color) } as CSSProperties) : {}),
    ...(list.width ? ({ "--column-width": `${list.width}px` } as CSSProperties) : {}),
  };

  return (
    <div className={`${listStyles.column} ${listStyles.overlay}`} style={style}>
      <div className={listStyles.header}>
        <h2 className={listStyles.title}>{list.title || "​"}</h2>
        <span className={listStyles.count}>{cardCount}</span>
      </div>
    </div>
  );
}
