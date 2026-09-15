import type { RefObject } from "react";

import type { IconKey, ListWidth, PaletteColor } from "../domain/types";
import { ColorSwatchPicker } from "./ColorSwatchPicker";
import styles from "./CustomizePanel.module.css";
import { IconPicker } from "./IconPicker";
import { Popover } from "./Popover";
import { WidthPicker } from "./WidthPicker";

interface CustomizePanelProps {
  readonly anchorRef: RefObject<HTMLElement | null>;
  readonly color: PaletteColor | undefined;
  readonly onColorChange: (color: PaletteColor | undefined) => void;
  readonly onClose: () => void;
  /** Lists only -- a card carries no icon of its own any more, so a caller
      that omits both of these simply gets no Icon section. */
  readonly icon?: IconKey;
  readonly onIconChange?: (icon: IconKey | undefined) => void;
  /** Lists only, same reasoning as the icon pair above -- a card has no
      width of its own to customise. */
  readonly width?: ListWidth;
  readonly onWidthChange?: (width: ListWidth | undefined) => void;
}

/**
 * The colour (and, for a list, icon) popover. Cards and lists used to share
 * an identical Icon section here; a card's has been dropped, since colour
 * turned out to be the only customisation anyone actually reached for on a
 * card, so the picker for the other is gone rather than left unused.
 *
 * A card's description used to live here too, but editing it meant opening
 * this popover -- which sits over part of the board -- just to change a few
 * words. It's now edited in place on the card itself (see CardItem.tsx),
 * where the rest of the board stays visible.
 */
export function CustomizePanel({
  anchorRef,
  color,
  onColorChange,
  onClose,
  icon,
  onIconChange,
  width,
  onWidthChange,
}: CustomizePanelProps) {
  return (
    <Popover anchorRef={anchorRef} onClose={onClose}>
      <div className={styles.section}>
        <span className={styles.label}>Colour</span>
        <ColorSwatchPicker value={color} onChange={onColorChange} />
      </div>
      {onIconChange && (
        <div className={styles.section}>
          <span className={styles.label}>Icon</span>
          <IconPicker value={icon} onChange={onIconChange} />
        </div>
      )}
      {onWidthChange && (
        <div className={styles.section}>
          <span className={styles.label}>Width</span>
          <WidthPicker value={width} onChange={onWidthChange} />
        </div>
      )}
    </Popover>
  );
}
