import { useState } from "react";
import { HexColorPicker } from "react-colorful";

import { parseHex } from "../domain/colors";
import type { HexColor } from "../domain/types";
import styles from "./CustomColorPicker.module.css";

interface CustomColorPickerProps {
  /** The colour the picker currently shows. */
  readonly color: HexColor;
  /** Called on every change while dragging or typing a complete hex. The
      caller previews it; nothing is saved yet. */
  readonly onDraftChange: (color: HexColor) => void;
  /** Called when a typed hex is confirmed with Enter. */
  readonly onConfirm: (color: HexColor) => void;
}

/**
 * A shade area, a hue slider and a hex box.
 *
 * It only reports colours; it never decides when one is saved. That belongs
 * to `CustomizePanel`, which turns a whole drag (however many `onDraftChange`
 * calls it makes) into a single store write.
 *
 * The hex box keeps its own text, because what's typed is often not yet a
 * colour ("1e9" on the way to "1e90ff"). The text follows the picker while it
 * is dragged; a bad entry is flagged out loud and the colour left alone.
 */
export function CustomColorPicker({ color, onDraftChange, onConfirm }: CustomColorPickerProps) {
  const [text, setText] = useState<string>(color);
  const [touched, setTouched] = useState(false);
  const [lastColor, setLastColor] = useState(color);

  // The colour changed from outside the box (the area or slider was
  // dragged): mirror it into the text and clear any error. Adjusting state
  // during render, guarded by the comparison, is React's own pattern for
  // this -- an effect would render once with a stale value first.
  if (color !== lastColor) {
    setLastColor(color);
    setText(color);
    setTouched(false);
  }

  const parsed = parseHex(text);
  const showError = touched && parsed === null;

  function handleTextChange(value: string) {
    setText(value);
    // Preview only a complete six-digit entry; three digits are usually the
    // start of six, and previewing them would flash the wrong colour.
    const complete = parseHex(value);
    if (complete && value.replace("#", "").length === 6 && complete !== color) {
      onDraftChange(complete);
      setLastColor(complete);
    }
  }

  function handleConfirm() {
    setTouched(true);
    if (parsed) {
      setText(parsed);
      onConfirm(parsed);
    }
  }

  return (
    <div className={styles.picker}>
      <HexColorPicker
        className={styles.area}
        color={color}
        onChange={(hex) => {
          const next = parseHex(hex);
          if (next) {
            onDraftChange(next);
          }
        }}
      />
      <label className={styles.hexRow}>
        <span className={styles.hexLabel}>Hex</span>
        <input
          className={`${styles.hexInput} ${showError ? styles.invalid : ""}`}
          value={text}
          onChange={(event) => handleTextChange(event.target.value)}
          onBlur={() => {
            setTouched(true);
            if (parsed && parsed !== color) {
              onDraftChange(parsed);
              setLastColor(parsed);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              handleConfirm();
            }
          }}
          spellCheck={false}
          autoComplete="off"
          maxLength={7}
          aria-label="Hex colour"
          aria-invalid={showError}
          aria-describedby={showError ? "hex-error" : undefined}
        />
      </label>
      {showError && (
        <p id="hex-error" className={styles.error} role="alert">
          Use a hex colour like #1e90ff
        </p>
      )}
    </div>
  );
}
