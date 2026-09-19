import { useState } from "react";

import { accentCss, isHexColor } from "../domain/colors";
import { PALETTE_COLORS, type HexColor, type ItemColor } from "../domain/types";
import { CustomColorPicker } from "./CustomColorPicker";
import styles from "./ColorSwatchPicker.module.css";

interface ColorSwatchPickerProps {
  /** The colour currently saved on the list or card. */
  readonly value: ItemColor | undefined;
  /** The colour being tried in the custom picker but not saved yet, if any. */
  readonly draft: HexColor | null;
  /** Custom colours used lately, most recent first. */
  readonly recent: readonly HexColor[];
  /** A swatch was clicked, or a typed hex confirmed: save this colour now. */
  readonly onChange: (color: ItemColor | undefined) => void;
  /** The custom picker moved. Preview it; do not save. */
  readonly onDraftChange: (color: HexColor) => void;
  /** Remove a custom colour from the recent list. */
  readonly onForget: (color: HexColor) => void;
}

/**
 * What the custom picker opens on: the colour already on the item, else a
 * neutral starting point. A palette colour is resolved through the CSS
 * custom property that defines it, so the palette stays defined in one place
 * (tokens.css) rather than being copied into a table here.
 */
function startingColor(value: ItemColor | undefined): HexColor {
  if (value !== undefined && isHexColor(value)) {
    return value;
  }
  const source = value === undefined ? "--accent" : `--palette-${value}`;
  const resolved = getComputedStyle(document.documentElement).getPropertyValue(source).trim();
  return (/^#[0-9a-f]{6}$/i.test(resolved) ? resolved.toLowerCase() : "#748ffc") as HexColor;
}

/**
 * The fixed palette, a "none" swatch, the "+" that opens the custom picker,
 * and the colours picked lately.
 *
 * It holds no colour of its own beyond whether the picker is open: saving is
 * the parent's decision (see `CustomizePanel`), so a drag in the picker is
 * one write however many times the colour changes on the way.
 */
export function ColorSwatchPicker({
  value,
  draft,
  recent,
  onChange,
  onDraftChange,
  onForget,
}: ColorSwatchPickerProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [start] = useState(() => startingColor(value));

  // A saved custom colour always shows as a swatch, even if it has aged out
  // of (or never reached) this browser's recent list, e.g. after an import.
  const customSwatches =
    value !== undefined && isHexColor(value) && !recent.includes(value) ? [value, ...recent] : recent;
  const isSelected = (color: ItemColor | undefined) => draft === null && value === color;

  return (
    <div className={styles.wrapper}>
      <div className={styles.grid} role="group" aria-label="Colour">
        <button
          type="button"
          className={`${styles.swatch} ${styles.none} ${isSelected(undefined) ? styles.selected : ""}`}
          onClick={() => onChange(undefined)}
          aria-label="No colour"
          aria-pressed={isSelected(undefined)}
        />
        {PALETTE_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={`${styles.swatch} ${isSelected(color) ? styles.selected : ""}`}
            style={{ background: accentCss(color) }}
            onClick={() => onChange(color)}
            aria-label={color}
            aria-pressed={isSelected(color)}
          />
        ))}
        <button
          type="button"
          className={`${styles.swatch} ${styles.custom} ${isPickerOpen ? styles.selected : ""}`}
          onClick={() => setIsPickerOpen((open) => !open)}
          aria-label="Custom colour"
          aria-expanded={isPickerOpen}
        >
          +
        </button>
        {customSwatches.map((color) => (
          <span key={color} className={styles.customItem}>
            <button
              type="button"
              className={`${styles.swatch} ${isSelected(color) ? styles.selected : ""}`}
              style={{ background: color }}
              onClick={() => onChange(color)}
              aria-label={color}
              aria-pressed={isSelected(color)}
            />
            {recent.includes(color) && (
              <button
                type="button"
                className={styles.forget}
                onClick={() => onForget(color)}
                aria-label={`Remove ${color} from saved colours`}
              >
                ×
              </button>
            )}
          </span>
        ))}
      </div>
      {isPickerOpen && (
        <CustomColorPicker
          color={draft ?? (value !== undefined && isHexColor(value) ? value : start)}
          onDraftChange={onDraftChange}
          onConfirm={onChange}
        />
      )}
    </div>
  );
}
