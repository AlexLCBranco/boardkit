import { PALETTE_COLORS, type PaletteColor } from "../domain/types";
import styles from "./ColorSwatchPicker.module.css";

interface ColorSwatchPickerProps {
  readonly value: PaletteColor | undefined;
  readonly onChange: (color: PaletteColor | undefined) => void;
}

/** A grid of the fixed palette, plus a "none" swatch that clears the colour. */
export function ColorSwatchPicker({ value, onChange }: ColorSwatchPickerProps) {
  return (
    <div className={styles.grid} role="group" aria-label="Colour">
      <button
        type="button"
        className={`${styles.swatch} ${styles.none} ${value === undefined ? styles.selected : ""}`}
        onClick={() => onChange(undefined)}
        aria-label="No colour"
        aria-pressed={value === undefined}
      />
      {PALETTE_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          className={`${styles.swatch} ${value === color ? styles.selected : ""}`}
          style={{ background: `var(--palette-${color})` }}
          onClick={() => onChange(color)}
          aria-label={color}
          aria-pressed={value === color}
        />
      ))}
    </div>
  );
}
