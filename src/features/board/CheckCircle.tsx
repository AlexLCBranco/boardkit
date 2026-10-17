import { Check } from "lucide-react";

import { CHECK_LABELS } from "../../domain/check";
import type { CheckMark } from "../../domain/types";
import styles from "./CheckCircle.module.css";

/**
 * A card's check circle, at the start of its title line. Empty until
 * clicked, then a green check, then a red one (domain/check.ts).
 *
 * Without `onCycle` it is a plain picture of the mark, for the lifted copy a
 * drag shows under the pointer, where nothing should be clickable.
 */
export function CheckCircle({
  mark,
  onCycle,
}: {
  readonly mark: CheckMark | undefined;
  readonly onCycle?: () => void;
}) {
  const label = CHECK_LABELS[mark ?? "none"];
  const icon = mark && <Check aria-hidden="true" strokeWidth={3} />;
  if (!onCycle) {
    return (
      <span className={styles.circle} data-check={mark} role="img" aria-label={label}>
        {icon}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={styles.circle}
      data-check={mark}
      onClick={onCycle}
      aria-label={`${label}. Click to change`}
      title={label}
    >
      {icon}
    </button>
  );
}
