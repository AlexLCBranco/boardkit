import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useState, type ReactNode } from "react";

import type { CardId, ListId } from "../../domain/types";
import { useCard, useReorderCardsWithinList } from "../../store/selectors";
import styles from "./CardItem.module.css";

/**
 * Owns the one `DndContext` the board uses, its sensors and its collision
 * strategy, so drag configuration never scatters across components.
 *
 * A pointer needs a few pixels of movement before a drag starts -- without
 * that constraint, `onClick` on a card (inline editing, delete) would never
 * fire, because every click begins as a pointer-down dnd-kit could otherwise
 * interpret as a drag. The keyboard sensor is close to free once the pointer
 * sensor exists, and it is the only way to reorder a card without a mouse.
 */
export function BoardDragContext({ children }: { readonly children: ReactNode }) {
  const [activeCardId, setActiveCardId] = useState<CardId | null>(null);
  const reorderCardsWithinList = useReorderCardsWithinList();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveCardId(event.active.id as CardId);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveCardId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    // Both cards must belong to the same list -- cross-list drops are out of
    // scope for this milestone, so anything else is left alone and the card
    // animates back to where it started.
    const activeListId = active.data.current?.listId as ListId | undefined;
    const overListId = over.data.current?.listId as ListId | undefined;
    if (!activeListId || activeListId !== overListId) {
      return;
    }

    reorderCardsWithinList(activeListId, active.id as CardId, over.id as CardId);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveCardId(null)}
    >
      {children}
      <DragOverlay>{activeCardId ? <CardOverlay cardId={activeCardId} /> : null}</DragOverlay>
    </DndContext>
  );
}

/**
 * The lifted copy dnd-kit renders under the pointer. It is a plain read of
 * the card's title -- no editing, no delete button -- since it exists purely
 * as a drag affordance, not an interactive element.
 */
function CardOverlay({ cardId }: { readonly cardId: CardId }) {
  const card = useCard(cardId);

  return (
    <article className={`${styles.card} ${styles.overlay}`}>
      <p className={styles.title}>{card.title}</p>
    </article>
  );
}
