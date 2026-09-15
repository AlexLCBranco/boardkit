import { LIST_WIDTHS, type ListWidth } from "../domain/types";
import styles from "./WidthPicker.module.css";

interface WidthPickerProps {
  readonly value: ListWidth | undefined;
  readonly onChange: (width: ListWidth | undefined) => void;
}

const WIDTH_LABELS: Record<ListWidth, string> = {
  normal: "Normal",
  wide: "Wide",
  wider: "Wider",
};

/** A three-way segmented control over the fixed width set -- same "closed
    set, one click" shape as ColorSwatchPicker and IconPicker, so lengthening
    a list's lines never produces a column size the drag layout wasn't tuned
    for. "Normal" clears the override rather than being its own stored value,
    matching how "no colour" and "no icon" both clear to `undefined`. */
export function WidthPicker({ value, onChange }: WidthPickerProps) {
  const selected = value ?? "normal";
  return (
    <div className={styles.group} role="group" aria-label="Width">
      {LIST_WIDTHS.map((width) => (
        <button
          key={width}
          type="button"
          className={`${styles.option} ${selected === width ? styles.selected : ""}`}
          onClick={() => onChange(width === "normal" ? undefined : width)}
          aria-pressed={selected === width}
        >
          {WIDTH_LABELS[width]}
        </button>
      ))}
    </div>
  );
}
