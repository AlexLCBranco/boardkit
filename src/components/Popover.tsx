import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

import styles from "./Popover.module.css";

interface PopoverProps {
  readonly anchorRef: RefObject<HTMLElement | null>;
  readonly onClose: () => void;
  readonly children: ReactNode;
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
 * It knows nothing about colours, icons, lists or cards -- only how to open
 * a panel near a trigger and close it on an outside click, Escape, or the
 * board scrolling underneath it.
 */
export function Popover({ anchorRef, onClose, children }: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) {
      return;
    }
    const rect = anchor.getBoundingClientRect();
    setPosition({ top: rect.bottom + 4, left: rect.left });
  }, [anchorRef]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) {
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
    document.addEventListener("scroll", onClose, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("scroll", onClose, true);
    };
  }, [anchorRef, onClose]);

  if (!position) {
    return null;
  }

  return createPortal(
    <div
      ref={panelRef}
      className={styles.panel}
      style={{ top: position.top, left: position.left }}
      role="dialog"
    >
      {children}
    </div>,
    document.body,
  );
}
