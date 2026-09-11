import type { NumberingScope } from "../../domain/types";
import { useNumberingScope, useSetNumberingScope } from "../../store/selectors";
import styles from "./NumberingControl.module.css";

const OPTIONS: ReadonlyArray<{ readonly value: NumberingScope; readonly label: string }> = [
  { value: "off", label: "Off" },
  { value: "list", label: "Per list" },
  { value: "board", label: "Continuous" },
];

/**
 * A board-level setting, not a per-list one: numbering some lists but not
 * others (or mixing per-list and continuous) would make the numbers
 * meaningless as soon as a card crossed between two differently-numbered
 * lists. It lives here, in the canvas that owns the whole board, rather than
 * on `App` -- see App.tsx's own note about staying ignorant of board
 * internals.
 */
export function NumberingControl() {
  const scope = useNumberingScope();
  const setScope = useSetNumberingScope();

  return (
    <div className={styles.control} role="radiogroup" aria-label="Card numbering">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={scope === option.value}
          className={`${styles.option} ${scope === option.value ? styles.active : ""}`}
          onClick={() => setScope(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
