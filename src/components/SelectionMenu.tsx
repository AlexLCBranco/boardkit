import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import styles from "./SelectionMenu.module.css";

export interface SelectionMenuItem {
  readonly label: string;
  /** A faint second line: what picking this item will add to. */
  readonly hint?: string;
  readonly onPick: () => void;
}

interface SelectionMenuProps {
  /** Where the right-click happened, in viewport pixels. */
  readonly x: number;
  readonly y: number;
  /** A line above the items saying what they act on. */
  readonly heading: string;
  readonly items: readonly SelectionMenuItem[];
  /** Escape, or a press outside the menu (`target` is what was pressed). */
  readonly onDismiss: (target: EventTarget | null) => void;
}

/** Clearance kept from the viewport's edges. Layout geometry, not a token. */
const EDGE_MARGIN = 8;

/**
 * A small menu that opens at the pointer, for acting on selected text.
 *
 * Not `Popover`: that one hangs under an anchor element, and this one has no
 * element to hang from, only the point where the right-click landed. Not
 * shadcn's ContextMenu either: that opens on its own right-click trigger,
 * while this has to open only when the right-click lands on a selection --
 * the caller decides, then renders this.
 *
 * Each item is numbered, and its number picks it straight from the
 * keyboard, so a two-way choice is one keypress: the menu takes focus as it
 * opens. Arrows and Enter work too.
 *
 * Portalled out of the card for the same reasons as `Popover` -- a card
 * sits inside scroll containers and carries a transform -- and, like it,
 * stops events at its edge so they never reach the card's drag listeners
 * or its own right-click handler through the React tree.
 */
export function SelectionMenu({ x, y, heading, items, onDismiss }: SelectionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const left = Math.max(EDGE_MARGIN, Math.min(x, window.innerWidth - menu.offsetWidth - EDGE_MARGIN));
    const top = Math.max(EDGE_MARGIN, Math.min(y, window.innerHeight - menu.offsetHeight - EDGE_MARGIN));
    setPosition({ top, left });
  }, [x, y]);

  // Focus waits until the menu is placed: until then it is
  // `visibility: hidden`, and a hidden element can't take focus.
  const isPlaced = position !== null;
  useEffect(() => {
    if (isPlaced) itemRefs.current[0]?.focus();
  }, [isPlaced]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current?.contains(event.target as Node)) return;
      onDismiss(event.target);
    }
    function handleScroll() {
      onDismiss(null);
    }
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, [onDismiss]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    // Kept here: a key must not reach the card's keyboard drag sensor or
    // the board's shortcuts.
    event.stopPropagation();
    const focused = itemRefs.current.indexOf(document.activeElement as HTMLButtonElement);
    const digit = Number(event.key);
    if (event.key === "Escape") {
      event.preventDefault();
      onDismiss(null);
    } else if (Number.isInteger(digit) && digit >= 1 && digit <= items.length) {
      event.preventDefault();
      items[digit - 1].onPick();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      itemRefs.current[(focused + step + items.length) % items.length]?.focus();
    }
  }

  return createPortal(
    <div
      ref={menuRef}
      className={styles.menu}
      style={position ?? { top: 0, left: 0, visibility: "hidden" }}
      role="menu"
      aria-label={heading}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onKeyDown={handleKeyDown}
    >
      <p className={styles.heading}>{heading}</p>
      {items.map((item, index) => (
        <button
          key={item.label}
          ref={(el) => {
            itemRefs.current[index] = el;
          }}
          type="button"
          role="menuitem"
          className={styles.item}
          onClick={item.onPick}
        >
          <kbd className={styles.key}>{index + 1}</kbd>
          <span className={styles.text}>
            <span>{item.label}</span>
            {item.hint && <span className={styles.hint}>{item.hint}</span>}
          </span>
        </button>
      ))}
    </div>,
    document.body,
  );
}
