import { useEffect, useRef, useState, type RefObject } from "react";

import { CARD_KIND_CHOICES, CARD_KIND_SPECS, NORMAL_KIND } from "../domain/cardKinds";
import type { CardKind, HexColor, IconKey, ItemColor } from "../domain/types";
import { useRecentColors, useRememberColor } from "../store/selectors";
import { ColorSwatchPicker } from "./ColorSwatchPicker";
import styles from "./CustomizePanel.module.css";
import { IconPicker } from "./IconPicker";
import { Popover } from "./Popover";

interface CustomizePanelProps {
  readonly anchorRef: RefObject<HTMLElement | null>;
  readonly color: ItemColor | undefined;
  /** Save a colour: one call, one undo step. */
  readonly onColorChange: (color: ItemColor | undefined) => void;
  /** Show a colour on the item without saving it -- called live while the
      custom picker is dragged, and with `null` when the preview ends. */
  readonly onColorPreview: (color: ItemColor | null) => void;
  readonly onClose: () => void;
  /** Lists only -- a card carries no icon of its own any more, so a caller
      that omits both of these simply gets no Icon section. */
  readonly icon?: IconKey;
  readonly onIconChange?: (icon: IconKey | undefined) => void;
  /** Cards only -- a list has no type, so a caller that omits `onKindChange`
      gets no "Card type" section. `kind` undefined means a normal card. */
  readonly kind?: CardKind;
  readonly onKindChange?: (kind: CardKind | undefined) => void;
}

/**
 * The colour (and, for a list, icon; for a card, type) popover. Cards and
 * lists used to share an identical Icon section here; a card's has been
 * dropped, since colour turned out to be the only customisation anyone
 * actually reached for on a card, so the picker for the other is gone rather
 * than left unused.
 *
 * A card's description used to live here too, but editing it meant opening
 * this popover -- which sits over part of the board -- just to change a few
 * words. It's now edited in place on the card itself (see CardItem.tsx),
 * where the rest of the board stays visible.
 *
 * List width used to have a third section here (a three-way picker over a
 * closed set of sizes) but is now a drag handle on the column's own right
 * edge instead -- direct manipulation beats a menu for a continuous value,
 * and it needed no closed set once dragging replaced picking.
 */
export function CustomizePanel({
  anchorRef,
  color,
  onColorChange,
  onColorPreview,
  onClose,
  icon,
  onIconChange,
  kind,
  onKindChange,
}: CustomizePanelProps) {
  const currentKind = kind ?? NORMAL_KIND;
  const recent = useRecentColors();
  const rememberColor = useRememberColor();

  // The custom picker's colour while it is being dragged or typed into. It
  // is shown live on the item (`onColorPreview`) but not saved: a drag fires
  // dozens of changes, and saving each would bury the undo stack and the
  // disk. The whole session becomes one write, when the panel closes or a
  // swatch or typed hex is confirmed. A ref mirrors it so `handleClose`
  // reads the latest value, not the one from the render it was created in.
  const [draft, setDraft] = useState<HexColor | null>(null);
  const draftRef = useRef<HexColor | null>(null);
  const isDiscardedRef = useRef(false);

  function updateDraft(next: HexColor | null) {
    draftRef.current = next;
    setDraft(next);
    onColorPreview(next);
  }

  function commit(next: ItemColor | undefined) {
    updateDraft(null);
    onColorChange(next);
    if (next !== undefined && next.startsWith("#")) {
      rememberColor(next as HexColor);
    }
  }

  // Escape abandons the draft. It has to be seen *before* Popover's own
  // Escape handler closes the panel (which would otherwise save it), so this
  // listens in the capture phase, which runs ahead of Popover's bubbling one.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        isDiscardedRef.current = true;
      }
    }
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  function handleClose() {
    const pending = draftRef.current;
    if (pending !== null && !isDiscardedRef.current) {
      commit(pending);
    } else {
      updateDraft(null);
    }
    onClose();
  }

  return (
    <Popover anchorRef={anchorRef} onClose={handleClose}>
      <div className={styles.section}>
        <span className={styles.label}>Colour</span>
        <ColorSwatchPicker
          value={color}
          draft={draft}
          recent={recent}
          onChange={commit}
          onDraftChange={updateDraft}
        />
      </div>
      {onIconChange && (
        <div className={styles.section}>
          <span className={styles.label}>Icon</span>
          <IconPicker value={icon} onChange={onIconChange} />
        </div>
      )}
      {onKindChange && (
        <div className={styles.section}>
          <span className={styles.label}>Card type</span>
          <div className={styles.choices} role="group" aria-label="Card type">
            {CARD_KIND_CHOICES.map((choice) => (
              <button
                key={choice}
                type="button"
                className={`${styles.choice} ${currentKind === choice ? styles.choiceSelected : ""}`}
                onClick={() => onKindChange(choice === NORMAL_KIND ? undefined : choice)}
                aria-pressed={currentKind === choice}
              >
                {CARD_KIND_SPECS[choice].label}
              </button>
            ))}
          </div>
        </div>
      )}
    </Popover>
  );
}
