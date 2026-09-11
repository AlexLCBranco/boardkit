import type { RefObject } from "react";

import type { IconKey, PaletteColor } from "../domain/types";
import { ColorSwatchPicker } from "./ColorSwatchPicker";
import styles from "./CustomizePanel.module.css";
import { IconPicker } from "./IconPicker";
import { Popover } from "./Popover";

interface CustomizePanelProps {
  readonly anchorRef: RefObject<HTMLElement | null>;
  readonly color: PaletteColor | undefined;
  readonly icon: IconKey | undefined;
  readonly onColorChange: (color: PaletteColor | undefined) => void;
  readonly onIconChange: (icon: IconKey | undefined) => void;
  readonly onClose: () => void;
}

/**
 * The colour-and-icon popover used for both a list and a card. It knows
 * nothing about which: the caller supplies the current values and the two
 * setters, so this is the same component either way.
 */
export function CustomizePanel({
  anchorRef,
  color,
  icon,
  onColorChange,
  onIconChange,
  onClose,
}: CustomizePanelProps) {
  return (
    <Popover anchorRef={anchorRef} onClose={onClose}>
      <div className={styles.section}>
        <span className={styles.label}>Colour</span>
        <ColorSwatchPicker value={color} onChange={onColorChange} />
      </div>
      <div className={styles.section}>
        <span className={styles.label}>Icon</span>
        <IconPicker value={icon} onChange={onIconChange} />
      </div>
    </Popover>
  );
}
