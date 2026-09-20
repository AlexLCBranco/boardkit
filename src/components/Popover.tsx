import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

import styles from "./Popover.module.css";

interface PopoverProps {
  readonly anchorRef: RefObject<HTMLElement | null>;
  readonly onClose: () => void;
  readonly children: ReactNode;
}

interface PopoverPosition {
  readonly top: number;
  readonly left: number;
  readonly maxHeight: number;
}

/** Gap between the panel and its anchor, and the minimum clearance kept from
    the viewport's edges. Layout geometry, not a visual token. */
const ANCHOR_GAP = 4;
const EDGE_MARGIN = 8;

/**
 * Where to put a panel of the given size so it stays fully on screen: below
 * the anchor when it fits there, otherwise above it when there is more room
 * there, and never past the viewport's edges. `maxHeight` is the room left
 * on the chosen side, so a panel taller than that scrolls inside itself
 * (`Popover.module.css`) instead of running off the page.
 */
function placePanel(anchor: DOMRect, width: number, height: number): PopoverPosition {
  const roomBelow = window.innerHeight - anchor.bottom - ANCHOR_GAP - EDGE_MARGIN;
  const roomAbove = anchor.top - ANCHOR_GAP - EDGE_MARGIN;
  const placeAbove = height > roomBelow && roomAbove > roomBelow;
  const maxHeight = Math.max(placeAbove ? roomAbove : roomBelow, 0);
  const shownHeight = Math.min(height, maxHeight);

  const top = placeAbove ? anchor.top - ANCHOR_GAP - shownHeight : anchor.bottom + ANCHOR_GAP;
  const maxLeft = window.innerWidth - width - EDGE_MARGIN;
  const left = Math.max(EDGE_MARGIN, Math.min(anchor.left, maxLeft));
  return { top, left, maxHeight };
}

/**
 * A small positioned popover, portalled to `document.body` and placed just
 * below whatever `anchorRef` points at.
 *
 * The portal is what keeps this generic: a board column and a card both sit
 * inside a scroll container (`overflow-y: auto` / `overflow-x: auto`), so a
 * popover positioned in the normal document flow would be clipped the
 * moment it tried to render past that container's edge. Rendering into
 * `document.body` with `position: fixed` escapes that entirely, at the cost
 * of tracking the anchor's position by hand rather than getting it from CSS.
 *
 * React events bubble through a portal to the *React* parent, not the DOM
 * one, and every popover here is rendered inside a draggable card or list. So
 * a press inside the panel would reach dnd-kit's pointer listener on that
 * card and start dragging it along with the picker. The panel stops
 * `pointerdown` at its own edge to keep the two apart.
 *
 * It knows nothing about colours, icons, lists or cards -- only how to open
 * a panel near a trigger and close it on an outside click, Escape, or the
 * board scrolling underneath it.
 */
export function Popover({ anchorRef, onClose, children }: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<PopoverPosition | null>(null);

  // Runs before paint, so the panel is measured and placed without ever
  // showing at a provisional spot.
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) {
      return;
    }
    setPosition(
      placePanel(anchor.getBoundingClientRect(), panel.offsetWidth, panel.offsetHeight),
    );
  }, [anchorRef]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) {
        return;
      }
      onClose();
    }

    // The panel can scroll itself when it is taller than the space it has;
    // that must not count as the board scrolling underneath it.
    function handleScroll(event: Event) {
      if (event.target instanceof Node && panelRef.current?.contains(event.target)) {
        return;
      }
      onClose();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    // Closing on scroll rather than repositioning: the popover is a brief,
    // single-purpose panel, not something worth tracking through a drag or a
    // board-wide scroll.
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, [anchorRef, onClose]);

  return createPortal(
    <div
      ref={panelRef}
      className={styles.panel}
      // Until measured the panel is rendered hidden at the origin, so its size
      // can be read.
      style={position ?? { top: 0, left: 0, visibility: "hidden" }}
      role="dialog"
      onPointerDown={(event) => event.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}
