import { ICON_KEYS, type IconKey } from "../domain/types";
import { Icon } from "./Icon";
import styles from "./IconPicker.module.css";

interface IconPickerProps {
  readonly value: IconKey | undefined;
  readonly onChange: (icon: IconKey | undefined) => void;
}

/** A grid of the fixed icon set, plus a "none" option that clears the icon. */
export function IconPicker({ value, onChange }: IconPickerProps) {
  return (
    <div className={styles.grid} role="group" aria-label="Icon">
      <button
        type="button"
        className={`${styles.option} ${value === undefined ? styles.selected : ""}`}
        onClick={() => onChange(undefined)}
        aria-label="No icon"
        aria-pressed={value === undefined}
      >
        <span className={styles.none} />
      </button>
      {ICON_KEYS.map((icon) => (
        <button
          key={icon}
          type="button"
          className={`${styles.option} ${value === icon ? styles.selected : ""}`}
          onClick={() => onChange(icon)}
          aria-label={icon}
          aria-pressed={value === icon}
        >
          <Icon name={icon} size={16} />
        </button>
      ))}
    </div>
  );
}
